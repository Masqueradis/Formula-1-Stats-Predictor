'use strict';

/**
 * Эпик-13 (BUG-04): создание гонки из админки.
 * Пустые date/координаты из формы не должны превращаться в '' для Postgres,
 * а сезон 2099 — валидный год.
 */

jest.mock('../src/repositories/raceRepository');
jest.mock('../src/services/predictionService');
jest.mock('../src/realtime/io', () => ({
  emitRaceStatus: jest.fn(),
}));

const raceRepository = require('../src/repositories/raceRepository');
const realtime = require('../src/realtime/io');
const raceService = require('../src/services/raceService');

beforeEach(() => {
  jest.clearAllMocks();
  raceRepository.create.mockImplementation(async (data) => ({ id: 1, ...data }));
});

describe('raceService.create — нормализация формы администратора', () => {
  test('сезон 2099 и пустые date/координаты сохраняются как NULL', async () => {
    const created = await raceService.create({
      name: '  TEST Grand Prix  ',
      circuit: '',
      country: '',
      date: '',
      season: '2099',
      round: '99',
      status: 'scheduled',
      trackLatitude: '',
      trackLongitude: '',
      broadcastUrl: '',
    });

    expect(raceRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'TEST Grand Prix',
        circuit: null,
        country: null,
        date: null,
        season: 2099,
        round: 99,
        trackLatitude: null,
        trackLongitude: null,
        broadcastUrl: null,
      }),
      {},
    );
    expect(created.season).toBe(2099);
    expect(created.date).toBeNull();
  });

  test('координаты-строки приводятся к числам', async () => {
    await raceService.create({
      name: 'TEST Grand Prix',
      season: 2099,
      round: 99,
      status: 'scheduled',
      trackLatitude: '43.7347',
      trackLongitude: '7.4206',
    });

    expect(raceRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ trackLatitude: 43.7347, trackLongitude: 7.4206 }),
      {},
    );
  });

  test('сезон вне диапазона → 400 с русским сообщением', async () => {
    await expect(raceService.create({ name: 'x', season: 1900, round: 1 }))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining('1950') });
    expect(raceRepository.create).not.toHaveBeenCalled();
  });

  test('нечисловая координата → 400', async () => {
    await expect(raceService.create({
      name: 'x', season: 2099, round: 1, trackLatitude: 'abc',
    })).rejects.toMatchObject({ status: 400, message: expect.stringContaining('Широта') });
  });

  test('некорректная ссылка на трансляцию → 400', async () => {
    await expect(raceService.create({
      name: 'x', season: 2099, round: 1, broadcastUrl: 'youtube.com/live',
    })).rejects.toMatchObject({ status: 400, message: expect.stringContaining('http') });
  });
});

describe('raceService.update — realtime-событие смены статуса (BUG-06)', () => {
  const OLD = { id: 5, externalId: '2026-20', name: 'Brazilian Grand Prix', status: 'scheduled' };
  const NEW = { id: 5, externalId: '2026-20', name: 'Brazilian Grand Prix', status: 'finished' };

  beforeEach(() => {
    raceRepository.findById.mockReset();
    raceRepository.update.mockReset();
    raceRepository.update.mockResolvedValue(NEW);
  });

  test('эмитит race:status с raceId/name/previous/status', async () => {
    raceRepository.findById.mockResolvedValueOnce(OLD).mockResolvedValueOnce(NEW);

    const result = await raceService.update(5, { status: 'finished' });

    expect(raceRepository.update).toHaveBeenCalledWith(5, { status: 'finished' });
    expect(realtime.emitRaceStatus).toHaveBeenCalledWith({
      raceId: '2026-20',
      name: 'Brazilian Grand Prix',
      previous: 'scheduled',
      status: 'finished',
    });
    expect(result).toMatchObject({ status: 'finished' });
  });

  test('для гонки без externalId ключом служит числовой id', async () => {
    const old = { id: 7, externalId: null, name: 'Test GP', status: 'scheduled' };
    const fresh = { id: 7, externalId: null, name: 'Test GP', status: 'cancelled' };
    raceRepository.findById.mockResolvedValueOnce(old).mockResolvedValueOnce(fresh);
    raceRepository.update.mockResolvedValue(fresh);

    await raceService.update(7, { status: 'cancelled' });

    expect(realtime.emitRaceStatus).toHaveBeenCalledWith(
      expect.objectContaining({ raceId: '7', previous: 'scheduled', status: 'cancelled' }),
    );
  });

  test('гонка не найдена → события нет', async () => {
    raceRepository.findById.mockResolvedValueOnce(null);
    raceRepository.update.mockResolvedValue(null);

    const result = await raceService.update(999, { status: 'finished' });

    expect(result).toMatchObject({ error: 'race not found', status: 404 });
    expect(realtime.emitRaceStatus).not.toHaveBeenCalled();
  });
});
