'use strict';

/**
 * careerService — юнит-тесты без сети и БД:
 * Jolpica-клиент и модели замоканы.
 */

jest.mock('../src/models', () => ({
  Driver: { findByPk: jest.fn() },
  RaceResult: { findAll: jest.fn(async () => []) },
}));

jest.mock('../src/clients/jolpicaClient', () => ({
  getJson: jest.fn(),
}));

const { Driver, RaceResult } = require('../src/models');
const jolpicaClient = require('../src/clients/jolpicaClient');
const careerService = require('../src/services/careerService');

function ergastResult({ season, position, points, grid, fastest = false }) {
  return {
    season: String(season),
    position: position == null ? null : String(position),
    positionText: position == null ? 'R' : String(position),
    points: String(points),
    grid: String(grid),
    FastestLap: { rank: fastest ? '1' : '2' },
  };
}

function page(races, total) {
  return { MRData: { total: String(total), RaceTable: { Races: races } } };
}

beforeEach(() => {
  jest.clearAllMocks();
  careerService.__resetCache();
});

describe('careerService.aggregate', () => {
  test('считает старты, победы, подиумы, поулы, БК, очки, сходы и сезоны', () => {
    const career = careerService.aggregate([
      ergastResult({ season: 2021, position: 1, points: 25, grid: 1, fastest: true }),
      ergastResult({ season: 2021, position: 2, points: 18, grid: 3 }),
      ergastResult({ season: 2021, position: null, points: 0, grid: 4 }), // сход
      ergastResult({ season: 2022, position: 4, points: 12, grid: 5 }),
    ]);

    expect(career).toMatchObject({
      starts: 4,
      wins: 1,
      podiums: 2,
      poles: 1,
      fastestLaps: 1,
      points: 55,
      dnfs: 1,
      bestFinish: 1,
      firstSeason: 2021,
      lastSeason: 2022,
    });
    expect(career.seasons).toEqual([
      { season: 2022, starts: 1, wins: 0, podiums: 0, points: 12 },
      { season: 2021, starts: 3, wins: 1, podiums: 2, points: 43 },
    ]);
  });
});

describe('careerService.getCareer', () => {
  test('Jolpica: ходит по страницам и кэширует результат', async () => {
    Driver.findByPk.mockResolvedValue({ id: 7, externalId: 'max_verstappen' });
    jolpicaClient.getJson
      .mockResolvedValueOnce(page(
        [{ season: '2023', Results: [ergastResult({ season: 2023, position: 1, points: 25, grid: 1 })] }],
        101, // total 101 при limit 100 → ждём две страницы
      ))
      .mockResolvedValueOnce(page(
        [{ season: '2024', Results: [ergastResult({ season: 2024, position: 3, points: 15, grid: 2, fastest: true })] }],
        101,
      ));

    const result = await careerService.getCareer(7);

    expect(result.source).toBe('jolpica');
    expect(result.career).toMatchObject({ starts: 2, wins: 1, podiums: 2, fastestLaps: 1, points: 40 });
    expect(jolpicaClient.getJson).toHaveBeenCalledTimes(2);
    expect(jolpicaClient.getJson.mock.calls[1][0]).toContain('offset=100');

    // повторный запрос — из кэша, без новых вызовов Jolpica
    const again = await careerService.getCareer(7);
    expect(again.cached).toBe(true);
    expect(jolpicaClient.getJson).toHaveBeenCalledTimes(2);
  });

  test('Jolpica недоступна → fallback на локальные результаты', async () => {
    Driver.findByPk.mockResolvedValue({ id: 3, externalId: 'someone' });
    jolpicaClient.getJson.mockRejectedValue(new Error('HTTP 503'));
    RaceResult.findAll.mockResolvedValue([
      { race: { season: 2026 }, position: 1, points: 25, grid: 1, fastestLap: true },
      { race: { season: 2026 }, position: null, points: 0, grid: 5, fastestLap: false },
    ]);

    const result = await careerService.getCareer(3);

    expect(result.source).toBe('local');
    expect(result.fallbackReason).toContain('jolpica');
    expect(result.career).toMatchObject({ starts: 2, wins: 1, podiums: 1, dnfs: 1, points: 25 });
  });

  test('нет externalId → только локальная статистика, Jolpica не вызывается', async () => {
    Driver.findByPk.mockResolvedValue({ id: 9, externalId: null });
    RaceResult.findAll.mockResolvedValue([
      { race: { season: 2026 }, position: 5, points: 10, grid: 6, fastestLap: false },
    ]);

    const result = await careerService.getCareer(9);

    expect(result.source).toBe('local');
    expect(jolpicaClient.getJson).not.toHaveBeenCalled();
    expect(result.career).toMatchObject({ starts: 1, points: 10 });
  });

  test('пилот не найден → 404', async () => {
    Driver.findByPk.mockResolvedValue(null);
    const result = await careerService.getCareer(999);
    expect(result).toEqual({ error: 'driver not found', status: 404 });
  });
});
