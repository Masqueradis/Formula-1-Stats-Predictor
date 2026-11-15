'use strict';

/**
 * Эпик-13 (BUG-04): создание гонки из админки.
 * Пустые date/координаты из формы не должны превращаться в '' для Postgres,
 * а сезон 2099 — валидный год.
 */

jest.mock('../src/repositories/raceRepository');
jest.mock('../src/services/predictionService');

const raceRepository = require('../src/repositories/raceRepository');
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
