'use strict';

/**
 * f1SyncService — юнит-тесты с моками Jolpica-клиента и in-memory моделями
 * (tests/helpers/fakeModels.js). Без сети и без БД.
 */

jest.mock('../src/models', () => {
  const { createFakeModel } = jest.requireActual('./helpers/fakeModels');
  return {
    Team: createFakeModel(),
    Driver: createFakeModel(),
    Race: createFakeModel(),
    RaceResult: createFakeModel(),
    SeasonTeam: createFakeModel(),
  };
});

jest.mock('../src/clients/jolpicaClient', () => ({
  getJson: jest.fn(),
  clearCache: jest.fn(),
  baseUrl: jest.fn(() => 'http://mock-jolpica'),
}));

const { Team, Driver, Race, RaceResult, SeasonTeam } = require('../src/models');
const jolpica = require('../src/clients/jolpicaClient');
const { syncSeason, raceExternalId } = require('../src/services/f1SyncService');

const SEASON = 2020;
const PAST_DATE = '2020-03-01';
const FUTURE_DATE = '2099-01-01';

const SPEEDY = {
  driverId: 'speedy', code: 'SPE', permanentNumber: '7',
  givenName: 'Sam', familyName: 'Speedy', nationality: 'British', dateOfBirth: '1995-01-01',
};
const CRUISE = {
  driverId: 'cruise', code: 'CRU', permanentNumber: '9',
  givenName: 'Chris', familyName: 'Cruise', nationality: 'American', dateOfBirth: '1996-02-02',
};
const ALPHA = { constructorId: 'alpha', name: 'Alpha Racing', nationality: 'Italian' };
const BETA = { constructorId: 'beta', name: 'Beta Motors', nationality: 'German' };

function payload(data) {
  return { MRData: data };
}

const SCHEDULE = payload({ RaceTable: { Races: [
  { round: '1', raceName: 'Past Grand Prix', date: PAST_DATE,
    Circuit: { circuitName: 'Past Circuit', Location: { lat: '10.5', long: '20.25', country: 'Testland' } } },
  { round: '2', raceName: 'Future Grand Prix', date: FUTURE_DATE,
    Circuit: { circuitName: 'Future Circuit', Location: { lat: '1', long: '2', country: 'Futureland' } } },
] } });

const CONSTRUCTORS = payload({ ConstructorTable: { Constructors: [ALPHA, BETA] } });

const DRIVERS = payload({ DriverTable: { Drivers: [
  SPEEDY,
  CRUISE,
  // тест-пилот без номера/кода — в ростер не попадает
  { driverId: 'rookie', givenName: 'Rita', familyName: 'Rookie' },
] } });

const STANDINGS = payload({ StandingsTable: { StandingsLists: [
  { DriverStandings: [
    { Driver: { driverId: 'speedy' }, Constructors: [{ constructorId: 'alpha' }] },
  ] },
] } });

const SPRINT_CALENDAR = payload({ RaceTable: { Races: [{ round: '1' }] } });

const RESULTS = payload({ RaceTable: { Races: [{ Results: [
  { position: '1', points: '25', grid: '1', FastestLap: { rank: '1' }, Driver: SPEEDY, Constructor: ALPHA },
  { position: '2', points: '18', grid: '2', Driver: CRUISE, Constructor: BETA },
  // место > 10 и 0 очков — строка пропускается
  { position: '15', points: '0', grid: '15', Driver: CRUISE, Constructor: BETA },
] }] } });

const SPRINT_RESULTS = payload({ RaceTable: { Races: [{ SprintResults: [
  { position: '1', points: '8', grid: '1', Driver: SPEEDY, Constructor: ALPHA },
] }] } });

function mockJolpica({ resultsThrow = false } = {}) {
  jolpica.getJson.mockImplementation(async (path) => {
    if (path === `/${SEASON}/?limit=100`) return SCHEDULE;
    if (path === `/${SEASON}/constructors/?limit=100`) return CONSTRUCTORS;
    if (path === `/${SEASON}/drivers/?limit=100`) return DRIVERS;
    if (path === `/${SEASON}/driverstandings/?limit=100`) return STANDINGS;
    if (path === `/${SEASON}/sprint/?limit=100`) return SPRINT_CALENDAR;
    if (path === `/${SEASON}/1/results/?limit=100`) {
      if (resultsThrow) throw new Error('boom');
      return RESULTS;
    }
    if (path === `/${SEASON}/1/sprint/?limit=100`) return SPRINT_RESULTS;
    throw new Error(`unexpected path in test: ${path}`);
  });
}

describe('f1SyncService (мок Jolpica + in-memory модели)', () => {
  beforeEach(() => {
    jolpica.getJson.mockReset();
    [Team, Driver, Race, RaceResult, SeasonTeam].forEach((m) => { m.rows.length = 0; });
    mockJolpica();
  });

  test('raceExternalId собирает внешний ключ сезон-этап', () => {
    expect(raceExternalId(2026, 18)).toBe('2026-18');
    expect(raceExternalId(2020, 1)).toBe('2020-1');
  });

  test('syncSeason создаёт команды/пилотов/гонки, сохраняет полную классификацию', async () => {
    const summary = await syncSeason(SEASON);

    expect(jolpica.getJson).toHaveBeenCalledWith(`/${SEASON}/?limit=100`);
    expect(jolpica.getJson).toHaveBeenCalledWith(`/${SEASON}/1/results/?limit=100`);

    expect(Team.rows).toHaveLength(2);
    // Эпик-10: исторические пилоты без code/number тоже попадают в БД
    expect(Driver.rows).toHaveLength(3);
    expect(Race.rows).toHaveLength(2);

    // координаты трассы приведены к числам
    const past = Race.rows.find((r) => r.round === 1);
    expect(past.trackLatitude).toBe(10.5);
    expect(past.trackLongitude).toBe(20.25);
    expect(past.country).toBe('Testland');
    // прошедшая гонка сразу finished
    expect(past.status).toBe('finished');

    const future = Race.rows.find((r) => r.round === 2);
    expect(future.status).toBe('scheduled');
    // будущая гонка: результаты не запрашивались
    expect(jolpica.getJson).not.toHaveBeenCalledWith(`/${SEASON}/2/results/?limit=100`);

    // Результаты: полная классификация (3 строки гонки, включая 15-е место) + спринт
    expect(RaceResult.rows).toHaveLength(4);
    expect(RaceResult.rows.filter((r) => r.sessionType === 'sprint')).toHaveLength(1);
    const win = RaceResult.rows.find((r) => r.position === 1 && r.sessionType === 'race');
    expect(win.points).toBe(25);
    expect(win.fastestLap).toBe(true);
    expect(win.grid).toBe(1);
    const tail = RaceResult.rows.find((r) => r.position === 15);
    expect(tail).toBeTruthy();
    expect(tail.points).toBe(0);

    // Подиумы исторического сезона не перезаписываются (защита текущего сезона)
    const speedy = Driver.rows.find((d) => d.externalId === 'speedy');
    expect(speedy.podiums).toBe(0);

    // seasonTeams: связки из результатов и стендингов, без дублей
    expect(SeasonTeam.rows).toHaveLength(2);
    expect(SeasonTeam.rows.every((r) => r.season === SEASON)).toBe(true);

    expect(summary).toMatchObject({ season: SEASON, teams: 2, drivers: 3, races: 2, results: 4, seasonTeams: 2 });
    expect(summary.active).toEqual({ season: SEASON, drivers: 2, teams: 2 });
    expect(summary.statusChanges).toEqual([]);
    expect(summary.errors).toEqual([]);
  });

  test('повторный syncSeason идемпотентен — дубликатов нет', async () => {
    await syncSeason(SEASON);
    await syncSeason(SEASON);

    expect(Team.rows).toHaveLength(2);
    expect(Driver.rows).toHaveLength(3);
    expect(Race.rows).toHaveLength(2);
    expect(RaceResult.rows).toHaveLength(4);
    expect(SeasonTeam.rows).toHaveLength(2);
  });

  test('scheduled-гонка с результатами переходит в finished и попадает в statusChanges', async () => {
    Race.rows.push({
      id: 100, externalId: '2020-1', season: SEASON, round: 1,
      name: 'Old name', status: 'scheduled',
    });

    const summary = await syncSeason(SEASON);

    expect(summary.statusChanges).toHaveLength(1);
    expect(summary.statusChanges[0]).toMatchObject({
      raceId: 100, externalId: '2020-1', previous: 'scheduled', status: 'finished',
    });
    expect(Race.rows.find((r) => r.id === 100).status).toBe('finished');
    expect(Race.rows.find((r) => r.id === 100).name).toBe('Past Grand Prix');
  });

  test('ошибка results-эндпоинта не роняет синк — попадает в summary.errors', async () => {
    mockJolpica({ resultsThrow: true });

    const summary = await syncSeason(SEASON);

    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]).toMatch(/^results 2020\/1: boom/);
    // остальные этапы и команды при этом обработаны; continue пропускает и sprint-запрос
    expect(summary.teams).toBe(2);
    expect(summary.races).toBe(2);
    expect(RaceResult.rows).toHaveLength(0);
  });
});
