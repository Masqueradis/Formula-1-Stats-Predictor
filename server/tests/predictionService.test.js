'use strict';

/**
 * predictionService — unit-тесты на моках репозиториев и realtime.
 * Покрывают ленивое создание/обновление документа, чтение, голоса,
 * комментарии/лайки и удаление документа гонки.
 */

const { Types } = require('mongoose');

jest.mock('../src/repositories/raceRepository');
jest.mock('../src/repositories/seasonTeamRepository');
jest.mock('../src/repositories/userRepository');
jest.mock('../src/repositories/predictionRepository');
jest.mock('../src/realtime/io', () => ({
  emitVote: jest.fn(),
  emitComment: jest.fn(),
}));

const raceRepository = require('../src/repositories/raceRepository');
const seasonTeamRepository = require('../src/repositories/seasonTeamRepository');
const userRepository = require('../src/repositories/userRepository');
const predictionRepository = require('../src/repositories/predictionRepository');
const realtime = require('../src/realtime/io');
const predictionService = require('../src/services/predictionService');

const RACE = {
  id: 1,
  externalId: '2026-1',
  name: 'Bahrain Grand Prix',
  circuit: 'Sakhir',
  country: 'Bahrain',
  date: '2099-03-01',
  season: 2026,
  round: 1,
  status: 'scheduled',
};

const SEASON_TEAMS = [
  {
    id: 1,
    driver: { id: 1, firstName: 'Max', lastName: 'Verstappen', abbreviation: 'VER', number: 1, isActive: true },
    team: { name: 'Red Bull', color: '#111111' },
  },
  {
    id: 2,
    driver: { id: 2, firstName: 'Lando', lastName: 'Norris', abbreviation: 'NOR', number: 4, isActive: true },
    team: { name: 'McLaren', color: '#ff8700' },
  },
  {
    id: 3,
    driver: { id: 3, firstName: 'Charles', lastName: 'Leclerc', abbreviation: 'LEC', number: 16, isActive: true },
    team: { name: 'Ferrari', color: '#dc0000' },
  },
  {
    id: 4,
    driver: { id: 3, firstName: 'Charles', lastName: 'Leclerc', abbreviation: 'LEC', number: 16, isActive: true },
    team: { name: 'Ferrari', color: '#dc0000' },
  },
  {
    id: 5,
    driver: { id: 9, firstName: 'Old', lastName: 'Driver', abbreviation: 'OLD', number: 99, isActive: false },
    team: { name: 'Ferrari', color: '#dc0000' },
  },
];

const ENTRIES = [
  {
    driverId: 1,
    firstName: 'Max',
    lastName: 'Verstappen',
    abbreviation: 'VER',
    number: 1,
    teamName: 'Red Bull',
    teamColor: '#111111',
  },
  {
    driverId: 2,
    firstName: 'Lando',
    lastName: 'Norris',
    abbreviation: 'NOR',
    number: 4,
    teamName: 'McLaren',
    teamColor: '#ff8700',
  },
  {
    driverId: 3,
    firstName: 'Charles',
    lastName: 'Leclerc',
    abbreviation: 'LEC',
    number: 16,
    teamName: 'Ferrari',
    teamColor: '#dc0000',
  },
];

function makeComments(list = []) {
  const comments = list.map((c) => ({ likes: [], ...c }));
  comments.id = (id) => comments.find((c) => String(c._id) === String(id));
  return comments;
}

function makeDoc(overrides = {}) {
  const doc = {
    raceId: '2026-1',
    raceName: RACE.name,
    circuit: RACE.circuit,
    country: RACE.country,
    date: RACE.date,
    season: RACE.season,
    round: RACE.round,
    status: 'scheduled',
    entries: ENTRIES,
    votes: [],
    comments: makeComments(),
    ...overrides,
  };
  doc.toObject = function toObject() {
    return this;
  };
  return doc;
}

const FULL_PICKS = [
  { driverId: 1, position: 1 },
  { driverId: 2, position: 2 },
  { driverId: 3, position: 3 },
];

beforeEach(() => {
  jest.clearAllMocks();
  raceRepository.findOne.mockResolvedValue(RACE);
  raceRepository.findById.mockResolvedValue(RACE);
  seasonTeamRepository.findAll.mockResolvedValue(SEASON_TEAMS);
  predictionRepository.setFields.mockImplementation(async (raceId, fields) =>
    makeDoc({ raceId, ...fields }),
  );
  predictionRepository.create.mockImplementation(async (data) => makeDoc(data));
  predictionRepository.findByRaceId.mockResolvedValue(makeDoc());
  predictionRepository.addVote.mockResolvedValue(makeDoc({ votes: [{ userId: 7, kind: 'full', picks: FULL_PICKS }] }));
  predictionRepository.updateVote.mockResolvedValue(makeDoc({ votes: [{ userId: 7, kind: 'full', picks: FULL_PICKS }] }));
  predictionRepository.removeVote.mockResolvedValue(makeDoc({ votes: [] }));
  predictionRepository.addComment.mockResolvedValue(
    makeDoc({ comments: makeComments([{ _id: new Types.ObjectId(), userId: 7, username: 'maxfan', text: 'Hi' }]) }),
  );
  predictionRepository.removeComment.mockResolvedValue(makeDoc());
  predictionRepository.removeLike.mockResolvedValue(makeDoc());
  predictionRepository.addLike.mockResolvedValue(makeDoc());
  userRepository.findById.mockResolvedValue({ id: 7, username: 'maxfan' });
});

describe('чтение документа', () => {
  test('getByRaceId возвращает документ с votingOpen', async () => {
    const data = await predictionService.getByRaceId('2026-1');

    expect(data.raceId).toBe('2026-1');
    expect(data.entries).toHaveLength(3);
    expect(data.votingOpen).toBe(true);
    expect(predictionRepository.setFields).not.toHaveBeenCalled();
  });

  test('getByRaceId обновляет снапшот при изменении статуса', async () => {
    predictionRepository.findByRaceId.mockResolvedValue(makeDoc({ status: 'finished' }));

    const data = await predictionService.getByRaceId('2026-1');

    expect(predictionRepository.setFields).toHaveBeenCalledWith('2026-1', { status: 'scheduled' });
    expect(data.status).toBe('scheduled');
  });

  test('getByRaceId лениво создаёт документ', async () => {
    predictionRepository.findByRaceId.mockResolvedValue(null);

    const data = await predictionService.getByRaceId('2026-1');

    expect(predictionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ raceId: '2026-1', entries: ENTRIES }),
    );
    expect(data.raceId).toBe('2026-1');
  });

  test('getByRaceId → 404 для неизвестной гонки', async () => {
    raceRepository.findOne.mockResolvedValue(null);
    raceRepository.findById.mockResolvedValue(null);

    await expect(predictionService.getByRaceId('nope')).rejects.toMatchObject({
      status: 404,
      message: 'Race not found',
    });
  });

  test('getNext → 404 без предстоящих гонок', async () => {
    raceRepository.findOne.mockResolvedValue(null);

    await expect(predictionService.getNext()).rejects.toMatchObject({
      status: 404,
      message: 'No upcoming race scheduled',
    });
  });

  test('getNext возвращает документ ближайшей гонки', async () => {
    const data = await predictionService.getNext();
    expect(data.raceId).toBe('2026-1');
    expect(data.votingOpen).toBe(true);
  });
});

describe('getStats', () => {
  test('дополняет рейтинг пилотами без голосов', async () => {
    predictionRepository.aggregateStats.mockResolvedValue([
      { _id: 1, avgPosition: 1.5, bestPosition: 1, worstPosition: 2, votesCount: 2, raceIds: ['2026-1'] },
      { _id: 2, avgPosition: 2.5, bestPosition: 2, worstPosition: 3, votesCount: 2, raceIds: ['2026-1'] },
    ]);

    const stats = await predictionService.getStats('2026-1');

    expect(stats).toHaveLength(3);
    expect(stats[0]).toMatchObject({ driverId: 1, avgPosition: 1.5, votesCount: 2 });
    expect(stats[0].driver.lastName).toBe('Verstappen');
    expect(stats[2]).toMatchObject({ driverId: 3, avgPosition: null, votesCount: 0 });
  });

  test('getStats без raceId берёт все документы', async () => {
    predictionRepository.findAll.mockResolvedValue([makeDoc()]);
    predictionRepository.aggregateStats.mockResolvedValue([
      { _id: 1, avgPosition: 2, bestPosition: 2, worstPosition: 2, votesCount: 1, raceIds: ['2026-1'] },
    ]);

    const stats = await predictionService.getStats();
    expect(stats).toHaveLength(1);
    expect(predictionRepository.aggregateStats).toHaveBeenCalledWith({});
  });
});

describe('голоса', () => {
  test('createVote сохраняет голос и отправляет realtime-событие', async () => {
    const data = await predictionService.createVote('2026-1', { id: 7 }, {
      kind: 'full',
      picks: FULL_PICKS,
    });

    expect(predictionRepository.addVote).toHaveBeenCalledWith(
      '2026-1',
      expect.objectContaining({ userId: 7, username: 'maxfan', kind: 'full', picks: FULL_PICKS }),
    );
    expect(data.votes).toHaveLength(1);
    expect(realtime.emitVote).toHaveBeenCalledWith(
      '2026-1',
      expect.objectContaining({ action: 'created', userId: 7, votesCount: 1 }),
    );
  });

  test('createVote → 409 при дубле голоса', async () => {
    predictionRepository.addVote.mockResolvedValue(null);

    await expect(
      predictionService.createVote('2026-1', { id: 7 }, { kind: 'full', picks: FULL_PICKS }),
    ).rejects.toMatchObject({ status: 409 });
  });

  test('createVote → 409, если гонка не scheduled', async () => {
    raceRepository.findOne.mockResolvedValue({ ...RACE, status: 'finished' });
    predictionRepository.findByRaceId.mockResolvedValue(makeDoc({ status: 'finished' }));

    await expect(
      predictionService.createVote('2026-1', { id: 7 }, { kind: 'full', picks: FULL_PICKS }),
    ).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/Voting is closed/) });
  });

  test('updateVote запрещает менять чужой голос', async () => {
    await expect(
      predictionService.updateVote('2026-1', 8, { id: 7, role: 'USER' }, { kind: 'full', picks: FULL_PICKS }),
    ).rejects.toMatchObject({ status: 403 });
  });

  test('updateVote доступен ADMIN и отправляет событие', async () => {
    const data = await predictionService.updateVote(
      '2026-1',
      7,
      { id: 1, role: 'ADMIN' },
      { kind: 'full', picks: FULL_PICKS },
    );

    expect(predictionRepository.updateVote).toHaveBeenCalled();
    expect(data.votes).toHaveLength(1);
    expect(realtime.emitVote).toHaveBeenCalledWith(
      '2026-1',
      expect.objectContaining({ action: 'updated', userId: 7 }),
    );
  });

  test('removeVote проверяет kind и отправляет событие', async () => {
    await expect(
      predictionService.removeVote('2026-1', 7, { id: 7, role: 'USER' }, 'bad-kind'),
    ).rejects.toMatchObject({ status: 400 });

    const data = await predictionService.removeVote('2026-1', 7, { id: 7, role: 'USER' }, 'full');
    expect(data.votes).toEqual([]);
    expect(realtime.emitVote).toHaveBeenCalledWith(
      '2026-1',
      expect.objectContaining({ action: 'removed', userId: 7 }),
    );
  });
});

describe('комментарии и лайки', () => {
  test('createComment валидирует текст', async () => {
    await expect(predictionService.createComment('2026-1', { id: 7 }, { text: '   ' })).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      predictionService.createComment('2026-1', { id: 7 }, { text: 'x'.repeat(2001) }),
    ).rejects.toMatchObject({ status: 422 });
  });

  test('createComment добавляет комментарий и отправляет событие', async () => {
    const data = await predictionService.createComment('2026-1', { id: 7 }, { text: '  Hello  ' });

    expect(predictionRepository.addComment).toHaveBeenCalledWith(
      '2026-1',
      expect.objectContaining({ userId: 7, username: 'maxfan', text: 'Hello' }),
    );
    expect(data.comments).toHaveLength(1);
    expect(realtime.emitComment).toHaveBeenCalledWith(
      '2026-1',
      expect.objectContaining({ action: 'created', userId: 7, commentsCount: 1 }),
    );
  });

  test('removeComment: невалидный id → 404, чужой → 403', async () => {
    await expect(
      predictionService.removeComment('2026-1', 'not-an-object-id', { id: 7, role: 'USER' }),
    ).rejects.toMatchObject({ status: 404 });

    const commentId = new Types.ObjectId();
    predictionRepository.findByRaceId.mockResolvedValue(
      makeDoc({ comments: makeComments([{ _id: commentId, userId: 8, text: 'other' }]) }),
    );

    await expect(
      predictionService.removeComment('2026-1', String(commentId), { id: 7, role: 'USER' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  test('removeComment удаляет свой комментарий', async () => {
    const commentId = new Types.ObjectId();
    predictionRepository.findByRaceId.mockResolvedValue(
      makeDoc({ comments: makeComments([{ _id: commentId, userId: 7, text: 'mine' }]) }),
    );
    predictionRepository.removeComment.mockResolvedValue(makeDoc({ comments: makeComments() }));

    const data = await predictionService.removeComment('2026-1', String(commentId), { id: 7, role: 'USER' });

    expect(data.comments).toHaveLength(0);
    expect(realtime.emitComment).toHaveBeenCalledWith(
      '2026-1',
      expect.objectContaining({ action: 'removed' }),
    );
  });

  test('toggleLike ставит и снимает лайк', async () => {
    const commentId = new Types.ObjectId();

    predictionRepository.findByRaceId.mockResolvedValue(
      makeDoc({ comments: makeComments([{ _id: commentId, userId: 8, text: 'hi', likes: [] }]) }),
    );
    predictionRepository.addLike.mockResolvedValue(
      makeDoc({ comments: makeComments([{ _id: commentId, userId: 8, text: 'hi', likes: [7] }]) }),
    );

    await predictionService.toggleLike('2026-1', String(commentId), { id: 7, role: 'USER' });
    expect(predictionRepository.addLike).toHaveBeenCalledWith('2026-1', String(commentId), 7);

    predictionRepository.findByRaceId.mockResolvedValue(
      makeDoc({ comments: makeComments([{ _id: commentId, userId: 8, text: 'hi', likes: [7] }]) }),
    );

    await predictionService.toggleLike('2026-1', String(commentId), { id: 7, role: 'USER' });
    expect(predictionRepository.removeLike).toHaveBeenCalledWith('2026-1', String(commentId), 7);
    expect(realtime.emitComment).toHaveBeenCalledWith(
      '2026-1',
      expect.objectContaining({ action: 'liked' }),
    );
  });
});

describe('удаление документа', () => {
  test('removeRaceDoc → 404 для неизвестной гонки', async () => {
    raceRepository.findOne.mockResolvedValue(null);
    raceRepository.findById.mockResolvedValue(null);

    await expect(predictionService.removeRaceDoc('nope')).rejects.toMatchObject({ status: 404 });
  });

  test('removeRaceDoc удаляет документ', async () => {
    predictionRepository.removeByRaceId.mockResolvedValue(makeDoc());

    const deleted = await predictionService.removeRaceDoc('2026-1');
    expect(deleted.raceId).toBe('2026-1');
  });

  test('cascadeRemoveByRace возвращает null при ошибке Mongo', async () => {
    predictionRepository.removeByRaceId.mockRejectedValue(new Error('mongo down'));

    await expect(predictionService.cascadeRemoveByRace(RACE)).resolves.toBeNull();
  });
});
