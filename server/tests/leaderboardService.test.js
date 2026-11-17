'use strict';

jest.mock('../src/repositories/raceRepository');
jest.mock('../src/repositories/raceResultRepository');
jest.mock('../src/repositories/userRepository');
jest.mock('../src/repositories/predictionRepository');

const raceRepository = require('../src/repositories/raceRepository');
const raceResultRepository = require('../src/repositories/raceResultRepository');
const userRepository = require('../src/repositories/userRepository');
const predictionRepository = require('../src/repositories/predictionRepository');
const leaderboardService = require('../src/services/leaderboardService');

function doc(raceId, votes = []) {
  return { raceId, votes };
}

beforeEach(() => {
  jest.clearAllMocks();
  raceRepository.findOne.mockResolvedValue(null);
  raceRepository.findById.mockResolvedValue(null);
  raceResultRepository.findAll.mockResolvedValue([]);
  predictionRepository.applyVoteScores.mockResolvedValue(null);
});

describe('recalculate', () => {
  test('пропускает документы без голосов и незавершённые гонки', async () => {
    predictionRepository.findAll.mockResolvedValue([
      doc('2026-1', []),
      doc('2026-2', [{ userId: 1, kind: 'full', picks: [] }]),
      doc('2026-3', [{ userId: 1, kind: 'full', picks: [] }]),
    ]);
    raceRepository.findOne.mockImplementation(async ({ externalId }) => {
      if (externalId === '2026-2') return { id: 2, status: 'finished' };
      if (externalId === '2026-3') return { id: 3, status: 'scheduled' };
      return null;
    });

    await expect(leaderboardService.recalculate()).resolves.toEqual({ races: 0, votes: 0 });
    expect(raceResultRepository.findAll).toHaveBeenCalledTimes(1);
    expect(predictionRepository.applyVoteScores).not.toHaveBeenCalled();
  });

  test('пропускает завершённую гонку без результатов', async () => {
    predictionRepository.findAll.mockResolvedValue([
      doc('2026-2', [{ userId: 1, kind: 'full', picks: [{ driverId: 1, position: 1 }] }]),
    ]);
    raceRepository.findOne.mockResolvedValue({ id: 2, status: 'finished' });
    raceResultRepository.findAll.mockResolvedValue([]);

    await expect(leaderboardService.recalculate()).resolves.toEqual({ races: 0, votes: 0 });
    expect(predictionRepository.applyVoteScores).not.toHaveBeenCalled();
  });

  test('считает баллы и пишет только изменившиеся голоса', async () => {
    predictionRepository.findAll.mockResolvedValue([
      doc('2026-2', [
        {
          userId: 1,
          kind: 'full',
          score: null,
          picks: [
            { driverId: 1, position: 1 },
            { driverId: 2, position: 3 },
          ],
        },
        {
          userId: 2,
          kind: 'top3',
          score: 1,
          picks: [{ driverId: 3, position: 2 }],
        },
      ]),
    ]);
    raceRepository.findOne.mockResolvedValue({ id: 2, status: 'finished' });
    raceResultRepository.findAll.mockResolvedValue([
      { driverId: 1, position: 1 },
      { driverId: 2, position: 2 },
      { driverId: 3, position: 3 },
    ]);

    const result = await leaderboardService.recalculate();

    expect(result).toEqual({ races: 1, votes: 1 });
    expect(predictionRepository.applyVoteScores).toHaveBeenCalledWith('2026-2', [
      { userId: 1, kind: 'full', score: 4, exactHits: 1, podiumHits: 1 },
    ]);
  });

  test('повторный пересчёт идемпотентен', async () => {
    predictionRepository.findAll.mockResolvedValue([
      doc('2026-2', [
        { userId: 1, kind: 'full', score: 3, picks: [{ driverId: 1, position: 1 }] },
      ]),
    ]);
    raceRepository.findOne.mockResolvedValue({ id: 2, status: 'finished' });
    raceResultRepository.findAll.mockResolvedValue([{ driverId: 1, position: 1 }]);

    await expect(leaderboardService.recalculate()).resolves.toEqual({ races: 0, votes: 0 });
    expect(predictionRepository.applyVoteScores).not.toHaveBeenCalled();
  });

  test('ищет гонку по числовому id, если externalId не найден', async () => {
    predictionRepository.findAll.mockResolvedValue([
      doc(5, [{ userId: 1, kind: 'full', score: 3, picks: [{ driverId: 1, position: 1 }] }]),
    ]);
    raceRepository.findById.mockResolvedValue({ id: 5, status: 'finished' });
    raceResultRepository.findAll.mockResolvedValue([{ driverId: 1, position: 1 }]);

    await expect(leaderboardService.recalculate()).resolves.toEqual({ races: 0, votes: 0 });
    expect(raceRepository.findById).toHaveBeenCalledWith(5);
  });
});

describe('getLeaderboard', () => {
  test('возвращает правила, total и отфильтровывает удалённых пользователей', async () => {
    predictionRepository.aggregateLeaderboard.mockResolvedValue([
      { _id: 1, points: 10, predictions: 3, exactHits: 2, podiumHits: 1 },
      { _id: 2, points: 5, predictions: 2, exactHits: 0, podiumHits: 2 },
      { _id: 3, points: 4, predictions: 1, exactHits: 1, podiumHits: 0 },
    ]);
    predictionRepository.countLeaderboardParticipants.mockResolvedValue(3);
    userRepository.findAll.mockResolvedValue([
      { id: 1, username: 'maxfan' },
      { id: 2, username: 'admin' },
    ]);

    const result = await leaderboardService.getLeaderboard(10);

    expect(result.rules).toEqual({ exact: 3, podium: 1 });
    expect(result.total).toBe(3);
    expect(result.users).toEqual([
      {
        rank: 1,
        userId: 1,
        username: 'maxfan',
        points: 10,
        predictions: 3,
        exactHits: 2,
        podiumHits: 1,
      },
      {
        rank: 2,
        userId: 2,
        username: 'admin',
        points: 5,
        predictions: 2,
        exactHits: 0,
        podiumHits: 2,
      },
    ]);
    expect(predictionRepository.aggregateLeaderboard).toHaveBeenCalledWith(10);
  });

  test('пустой рейтинг', async () => {
    predictionRepository.aggregateLeaderboard.mockResolvedValue([]);
    predictionRepository.countLeaderboardParticipants.mockResolvedValue(0);
    userRepository.findAll.mockResolvedValue([]);

    await expect(leaderboardService.getLeaderboard()).resolves.toEqual({
      rules: { exact: 3, podium: 1 },
      total: 0,
      users: [],
    });
  });
});
