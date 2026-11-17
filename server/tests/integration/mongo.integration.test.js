'use strict';

const mongoose = require('mongoose');

const RUN = process.env.INTEGRATION === '1';
const maybe = RUN ? describe : describe.skip;

let predictionRepository;
let leaderboardService;
let raceRepository;
let raceResultRepository;

const TEST_RACE_ID = 'jest-it-000';
let raceForScoring = null;

jest.setTimeout(60000);

maybe('MongoDB repository (integration)', () => {
  beforeAll(async () => {
    require('../../src/config/env');
    await mongoose.connect(process.env.MONGO_URI, {
      runtimeAdapters: { os: require('os') },
    });
    predictionRepository = require('../../src/repositories/predictionRepository');
    leaderboardService = require('../../src/services/leaderboardService');
    raceRepository = require('../../src/repositories/raceRepository');
    raceResultRepository = require('../../src/repositories/raceResultRepository');

    const races = await raceRepository.findAll({ where: { status: 'finished' } });
    for (const race of races) {
      const results = await raceResultRepository.findAll({ where: { raceId: race.id, sessionType: 'race' } });
      if (results.length > 0) {
        raceForScoring = { race, results };
        break;
      }
    }
  });

  afterAll(async () => {
    await predictionRepository.removeByRaceId(TEST_RACE_ID);
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    await require('../../src/models').sequelize.close();
  });

  afterEach(async () => {
    await predictionRepository.removeByRaceId(TEST_RACE_ID);
  });

  async function createTestDoc(extra = {}) {
    return predictionRepository.create({
      raceId: TEST_RACE_ID,
      raceName: 'Jest Integration GP',
      circuit: 'Test Circuit',
      country: 'XX',
      date: '2030-01-01',
      season: 2030,
      round: 99,
      status: 'scheduled',
      entries: [{ driverId: 1, firstName: 'A', lastName: 'One', abbreviation: 'ONE', number: 1, teamId: 1, teamName: 'T1', teamColor: '#fff' }],
      votes: [],
      comments: [],
      ...extra,
    });
  }

  test('create + findByRaceId: документ сохраняется и читается', async () => {
    await createTestDoc();
    const doc = await predictionRepository.findByRaceId(TEST_RACE_ID);
    expect(doc).not.toBeNull();
    expect(doc.raceName).toBe('Jest Integration GP');
    expect(doc.votes).toHaveLength(0);
  });

  test('addVote: $push добавляет голос, повтор той же пары (userId,kind) отклоняется (null)', async () => {
    await createTestDoc();
    const vote = { userId: 777, username: 'jester', kind: 'top3', picks: [{ driverId: 1, position: 1 }] };

    const updated = await predictionRepository.addVote(TEST_RACE_ID, vote);
    expect(updated.votes).toHaveLength(1);

    const duplicate = await predictionRepository.addVote(TEST_RACE_ID, vote);
    expect(duplicate).toBeNull();
  });

  test('addVote: full и top3 одного пользователя сосуществуют', async () => {
    await createTestDoc();
    await predictionRepository.addVote(TEST_RACE_ID, { userId: 777, username: 'jester', kind: 'full', picks: [] });
    const updated = await predictionRepository.addVote(TEST_RACE_ID, { userId: 777, username: 'jester', kind: 'top3', picks: [] });
    expect(updated.votes.map((v) => v.kind).sort()).toEqual(['full', 'top3']);
  });

  test('updateVote: позиционный $ бьёт ровно в нужный (userId, kind)', async () => {
    await createTestDoc();
    await predictionRepository.addVote(TEST_RACE_ID, { userId: 777, username: 'jester', kind: 'full', picks: [{ driverId: 1, position: 2 }] });
    await predictionRepository.addVote(TEST_RACE_ID, { userId: 777, username: 'jester', kind: 'top3', picks: [{ driverId: 1, position: 3 }] });

    const updated = await predictionRepository.updateVote(TEST_RACE_ID, 777, {
      kind: 'top3',
      picks: [{ driverId: 1, position: 1 }],
    });

    const top3 = updated.votes.find((v) => v.kind === 'top3');
    const full = updated.votes.find((v) => v.kind === 'full');
    expect(top3.picks[0].position).toBe(1);
    expect(full.picks[0].position).toBe(2);
  });

  test('removeVote: с kind удаляет только указанный тип, без kind — все голоса юзера', async () => {
    await createTestDoc();
    await predictionRepository.addVote(TEST_RACE_ID, { userId: 777, username: 'j', kind: 'full', picks: [] });
    await predictionRepository.addVote(TEST_RACE_ID, { userId: 777, username: 'j', kind: 'top3', picks: [] });

    const afterKind = await predictionRepository.removeVote(TEST_RACE_ID, 777, 'top3');
    expect(afterKind.votes.map((v) => v.kind)).toEqual(['full']);

    const afterAll = await predictionRepository.removeVote(TEST_RACE_ID, 777);
    expect(afterAll.votes).toHaveLength(0);
  });

  test('aggregateStats: народный рейтинг учитывает только kind=full', async () => {
    await createTestDoc();
    await predictionRepository.addVote(TEST_RACE_ID, {
      userId: 1, username: 'a', kind: 'full',
      picks: [{ driverId: 1, position: 1 }, { driverId: 2, position: 2 }],
    });
    await predictionRepository.addVote(TEST_RACE_ID, {
      userId: 2, username: 'b', kind: 'full',
      picks: [{ driverId: 1, position: 1 }, { driverId: 2, position: 3 }],
    });
    await predictionRepository.addVote(TEST_RACE_ID, {
      userId: 3, username: 'c', kind: 'top3',
      picks: [{ driverId: 1, position: 1 }],
    });

    const stats = await predictionRepository.aggregateStats({ raceId: TEST_RACE_ID });
    const byDriver = new Map(stats.map((s) => [s._id, s]));
    expect(byDriver.get(1).votesCount).toBe(2);
    expect(byDriver.get(1).bestPosition).toBe(1);
    expect(byDriver.get(1).avgPosition).toBe(1);
  });

  test('applyVoteScores: bulkWrite записывает баллы в нужные голоса (в т.ч. при full+top3 у юзера)', async () => {
    await createTestDoc();
    await predictionRepository.addVote(TEST_RACE_ID, { userId: 777, username: 'j', kind: 'full', picks: [] });
    await predictionRepository.addVote(TEST_RACE_ID, { userId: 777, username: 'j', kind: 'top3', picks: [] });
    await predictionRepository.addVote(TEST_RACE_ID, { userId: 888, username: 'k', kind: 'full', picks: [] });

    await predictionRepository.applyVoteScores(TEST_RACE_ID, [
      { userId: 777, kind: 'full', score: 7, exactHits: 2, podiumHits: 1 },
    ]);

    const doc = await predictionRepository.findByRaceId(TEST_RACE_ID);
    const full = doc.votes.find((v) => v.userId === 777 && v.kind === 'full');
    const top3 = doc.votes.find((v) => v.userId === 777 && v.kind === 'top3');
    const other = doc.votes.find((v) => v.userId === 888);
    expect(full.score).toBe(7);
    expect(full.exactHits).toBe(2);
    expect(full.podiumHits).toBe(1);
    expect(top3.score).toBeNull();
    expect(other.score).toBeNull();
  });

  test('recalculate (кросс-БД): завершённая гонка получает баллы, повтор идемпотентен', async () => {
    if (!raceForScoring) {
      console.warn('нет завершённых гонок с результатами — тест пропущен');
      return;
    }
    const { race, results } = raceForScoring;
    const byPos = results
      .filter((r) => Number(r.position) > 0)
      .sort((a, b) => a.position - b.position);
    const docRaceId = String(race.externalId || race.id);

    const picks = byPos.map((r) => ({ driverId: r.driverId, position: Number(r.position) }));
    await predictionRepository.create({
      raceId: docRaceId,
      raceName: `Jest scoring ${docRaceId}`,
      circuit: '', country: '', date: String(race.date || ''), season: race.season, round: race.round,
      status: 'finished',
      entries: [],
      votes: [{ userId: 999999, username: 'jest_scoring', kind: 'full', picks }],
      comments: [],
    });

    try {
      const first = await leaderboardService.recalculate();
      expect(first.votes).toBeGreaterThan(0);

      const doc = await predictionRepository.findByRaceId(docRaceId);
      const vote = doc.votes.find((v) => v.userId === 999999);
      expect(vote.score).toBe(picks.length * 3);

      const second = await leaderboardService.recalculate();
      expect(second.votes).toBe(0);

      const raw = await predictionRepository.aggregateLeaderboard(200);
      const row = raw.find((r) => r._id === 999999);
      expect(row).toBeDefined();
      expect(row.points).toBe(picks.length * 3);

      const board = await leaderboardService.getLeaderboard(200);
      expect(board.rules).toEqual({ exact: 3, podium: 1 });
      expect(board.total).toBeGreaterThan(0);
      expect(Array.isArray(board.users)).toBe(true);
    } finally {
      await predictionRepository.removeByRaceId(docRaceId);
    }
  });
});
