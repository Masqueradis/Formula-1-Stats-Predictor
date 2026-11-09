'use strict';

/**
 * probabilityService.getNextProbabilities — расчёт Softmax на моках репозитория.
 * Проверяем 404, сборку признаков, дедуп состава, прошлый сезон и нормировку.
 */

jest.mock('../src/repositories/probabilityRepository');

const probabilityRepository = require('../src/repositories/probabilityRepository');
const probabilityService = require('../src/services/probabilityService');

const RACE = {
  id: 10,
  name: 'Italian Grand Prix',
  circuit: 'Monza',
  country: 'Italy',
  date: '2026-09-06',
  season: 2026,
  round: 16,
};

function seasonTeam(id, driverId, lastName, teamId, teamName, extra = {}) {
  return {
    id,
    driver: {
      id: driverId,
      firstName: 'Driver',
      lastName,
      abbreviation: lastName.slice(0, 3).toUpperCase(),
      number: driverId,
      isActive: true,
      ...extra.driver,
    },
    team: {
      id: teamId,
      name: teamName,
      color: '#123456',
      isActive: true,
      ...extra.team,
    },
  };
}

const ROSTER = [
  seasonTeam(1, 1, 'Verstappen', 1, 'Red Bull'),
  seasonTeam(2, 2, 'Norris', 2, 'McLaren'),
  seasonTeam(3, 3, 'Leclerc', 2, 'McLaren'),
  // дубль пилота в составе (перешёл в другую команду) — должен схлопнуться
  seasonTeam(4, 1, 'Verstappen', 1, 'Red Bull'),
  // архивный пилот не попадает в прогноз
  seasonTeam(5, 4, 'Retired', 3, 'Old Team', { driver: { isActive: false } }),
  // архивная команда не попадает в прогноз
  seasonTeam(6, 5, 'NoTeam', 4, 'Defunct', { team: { isActive: false } }),
];

function result(driverId, teamId, raceId, round, grid, position, points, extra = {}) {
  return {
    driverId,
    teamId,
    raceId,
    sessionType: 'race',
    grid,
    position,
    points,
    race: { id: raceId, date: `2026-0${Math.min(round, 9)}-01`, round, season: 2026 },
    ...extra,
  };
}

const SEASON_RESULTS = [
  result(1, 1, 1, 1, 1, 1, 25),
  result(2, 2, 1, 1, 3, 2, 18),
  result(3, 2, 1, 1, 5, 5, 10),
  result(1, 1, 2, 2, 2, 1, 25),
  result(2, 2, 2, 2, 1, 3, 15),
  result(3, 2, 2, 2, 6, 4, 12),
  // спринт не должен увеличивать currentRaces
  { ...result(1, 1, 2, 2, 1, 1, 8), sessionType: 'sprint' },
];

const PREVIOUS_RESULTS = [
  result(1, 1, 101, 1, 1, 1, 25, { race: { id: 101, date: '2025-03-01', round: 1, season: 2025 } }),
  result(2, 2, 101, 1, 2, 2, 18, { race: { id: 101, date: '2025-03-01', round: 1, season: 2025 } }),
];

const CIRCUIT_RESULTS = [
  { driverId: 1, position: 1, sessionType: 'race' },
  { driverId: 2, position: 8, sessionType: 'race' },
  { driverId: 3, position: 3, sessionType: 'race' },
  { driverId: 2, position: 2, sessionType: 'sprint' },
];

beforeEach(() => {
  jest.clearAllMocks();
  probabilityRepository.findNextRace.mockResolvedValue(RACE);
  probabilityRepository.findRoster.mockResolvedValue(ROSTER);
  probabilityRepository.findSeasonResults.mockImplementation(async (season) =>
    season === 2026 ? SEASON_RESULTS : PREVIOUS_RESULTS,
  );
  probabilityRepository.findCircuitResults.mockResolvedValue(CIRCUIT_RESULTS);
});

describe('getNextProbabilities', () => {
  test('404, если предстоящих гонок нет', async () => {
    probabilityRepository.findNextRace.mockResolvedValue(null);

    await expect(probabilityService.getNextProbabilities()).rejects.toMatchObject({
      status: 404,
      message: 'No upcoming race scheduled',
    });
  });

  test('считает вероятности и возвращает метаданные формулы', async () => {
    const resultData = await probabilityService.getNextProbabilities();

    expect(resultData.race).toEqual(RACE);
    expect(resultData.weights).toEqual(probabilityService.WEIGHTS);
    expect(resultData.basis).toMatchObject({
      currentRaces: 2,
      previousRaces: 1,
      previousSeason: 2025,
      formWindow: probabilityService.FORM_RACES,
      usesPreviousSeason: true,
    });

    // дубли и архивные отфильтрованы
    expect(resultData.drivers).toHaveLength(3);
    expect(resultData.drivers.map((d) => d.id).sort()).toEqual([1, 2, 3]);

    for (const driver of resultData.drivers) {
      expect(driver.team).toHaveProperty('name');
      expect(driver.features).toEqual(
        expect.objectContaining({
          P_qual: expect.any(Number),
          F_driver: expect.any(Number),
          F_team: expect.any(Number),
          H_track: expect.any(Number),
        }),
      );
      expect(['current', 'previous', 'blended', 'neutral']).toContain(driver.formSource);
      expect(driver.probability).toBeGreaterThan(0);
    }

    const total = resultData.drivers.reduce((sum, d) => sum + d.probability, 0);
    expect(total).toBeGreaterThan(99.9);
    expect(total).toBeLessThanOrEqual(100.1);

    const probabilities = resultData.drivers.map((d) => d.probability);
    expect([...probabilities].sort((a, b) => b - a)).toEqual(probabilities);
  });

  test('пилот без прошлого сезона помечается formSource=current', async () => {
    const resultData = await probabilityService.getNextProbabilities();
    const leclerc = resultData.drivers.find((d) => d.id === 3);

    // у Леклера есть текущие результаты (2026), но нет предыдущего сезона (2025)
    expect(leclerc.formSource).toBe('current');
    expect(leclerc.features.H_track).toBeGreaterThan(0);
  });
});
