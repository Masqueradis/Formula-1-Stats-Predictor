'use strict';

jest.mock('../src/models');

const { SeasonTeam, RaceResult } = require('../src/models');
const standingsService = require('../src/services/standingsService');

function seasonTeam(id, driverId, lastName, teamId, teamName, isReserve = false) {
  return {
    id,
    driverId,
    season: 2026,
    isReserve,
    driver: {
      id: driverId,
      firstName: 'Driver',
      lastName,
      abbreviation: lastName.slice(0, 3).toUpperCase(),
      isActive: true,
    },
    team: { id: teamId, name: teamName, color: '#123456', isActive: true },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  SeasonTeam.findAll.mockResolvedValue([]);
  RaceResult.findAll.mockResolvedValue([]);
});

describe('getStandings — текущая команда (BUG-08)', () => {
  test('боевая строка важнее резервной, даже если резервная добавлена позже', async () => {
    SeasonTeam.findAll.mockResolvedValue([
      seasonTeam(11, 20, 'Lawson', 5, 'Racing Bulls'),
      seasonTeam(682, 20, 'Lawson', 1, 'Red Bull', true),
      seasonTeam(7, 21, 'Bearman', 6, 'Haas'),
      seasonTeam(16, 22, 'Ocon', 6, 'Haas', true),
    ]);

    const result = await standingsService.getStandings(2026, 'drivers');
    const lawson = result.standings.find((d) => d.id === 20);

    expect(result.standings).toHaveLength(3);
    expect(lawson.team.name).toBe('Racing Bulls');
    expect(result.standings.find((d) => d.id === 22).team.name).toBe('Haas');
  });

  test('при двух боевых строках берётся меньший id (до сверки данных)', async () => {
    SeasonTeam.findAll.mockResolvedValue([
      seasonTeam(11, 20, 'Lawson', 5, 'Racing Bulls'),
      seasonTeam(20, 20, 'Lawson', 1, 'Red Bull'),
    ]);

    const result = await standingsService.getStandings(2026, 'drivers');

    expect(result.standings).toHaveLength(1);
    expect(result.standings[0].team.name).toBe('Racing Bulls');
  });
});
