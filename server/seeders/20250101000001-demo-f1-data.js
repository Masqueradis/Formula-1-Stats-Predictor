'use strict';

const season = require('./data/season2026');
const { TEAM_META } = require('../src/data/teamMeta');

function teamRows() {
  return season.constructors.map((c) => {
    const meta = TEAM_META[c.externalId] || {};
    return {
      externalId: c.externalId,
      name: meta.name || c.sourceName,
      principal: meta.principal || null,
      nationality: meta.nationality || c.nationality || null,
      url: meta.url || c.url || null,
      color: meta.color || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });
}

function podiumCounts() {
  const counts = {};
  for (const race of season.results) {
    for (const r of race.results) {
      if (r.position <= 3) {
        counts[r.driverExternalId] = (counts[r.driverExternalId] || 0) + 1;
      }
    }
  }
  return counts;
}

function driverRows() {
  const podiums = podiumCounts();
  return season.drivers.map((d) => ({
    externalId: d.externalId,
    firstName: d.firstName,
    lastName: d.lastName,
    abbreviation: d.abbreviation,
    number: d.number,
    nationality: d.nationality,
    dateOfBirth: d.dateOfBirth || null,
    imageUrl: null,
    podiums: podiums[d.externalId] || 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

function raceRows() {
  const today = new Date().toISOString().slice(0, 10);
  const finishedExternalIds = new Set(season.results.map((r) => `2026-${r.round}`));
  return season.races.map((r) => ({
    externalId: r.externalId,
    name: r.name,
    circuit: r.circuit,
    country: r.country,
    date: r.date,
    season: season.season,
    round: r.round,
    status: finishedExternalIds.has(r.externalId) ? 'finished' : r.date < today ? 'cancelled' : 'scheduled',
    trackLatitude: r.trackLatitude,
    trackLongitude: r.trackLongitude,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

async function externalIdMap(queryInterface, table) {
  const [rows] = await queryInterface.sequelize.query(`SELECT id, "externalId" FROM "${table}"`);
  return new Map(rows.map((row) => [row.externalId, row.id]));
}

module.exports = {
  async up(queryInterface) {
    // Идемпотентность (эпик-08): контейнер запускает сиды при каждом старте.
    // Если данные уже вставлены (например, прошлым прогоном вне sequelize-cli),
    // просто выходим — sequelize-cli запишет сидер в SequelizeData и не будет
    // падать на дублях (externalId/username — уникальные ключи).
    const [[{ count }]] = await queryInterface.sequelize.query(
      'SELECT count(*)::int AS count FROM "teams"',
    );
    if (count > 0) {
      console.log('demo-f1-data: already seeded — skip');
      return;
    }

    await queryInterface.bulkInsert('users', [
      { username: 'admin', email: 'admin@f1stats.test', passwordHash: '$2b$10$PdvgdIQTw2oa5gD0BuEI6eWPFXfa0a.JRKyw4aQHkkn9nUpwKep0e', role: 'ADMIN', isVerified: true, verificationToken: null, createdAt: new Date(), updatedAt: new Date() },
      { username: 'maxfan', email: 'maxfan@f1stats.test', passwordHash: '$2b$10$X61gU0qBJdza4hPW5/YAMuc8qXTRozBr0F6vkFFQhW9AnQwjLpTSu', role: 'USER', isVerified: true, verificationToken: null, createdAt: new Date(), updatedAt: new Date() },
    ], {});

    await queryInterface.bulkInsert('teams', teamRows(), {});
    await queryInterface.bulkInsert('drivers', driverRows(), {});
    await queryInterface.bulkInsert('races', raceRows(), {});

    const teamIds = await externalIdMap(queryInterface, 'teams');
    const driverIds = await externalIdMap(queryInterface, 'drivers');
    const raceIds = await externalIdMap(queryInterface, 'races');

    const seasonTeams = season.seasonTeamsOrdered
      .filter((s) => driverIds.has(s.driverExternalId) && teamIds.has(s.teamExternalId))
      .map((s) => ({
        season: season.season,
        driverId: driverIds.get(s.driverExternalId),
        teamId: teamIds.get(s.teamExternalId),
        // Тсунода-2026 — резервист (разовый старт), не входит в состав гонок для голосования
        isReserve: s.driverExternalId === 'tsunoda',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    await queryInterface.bulkInsert('season_teams', seasonTeams, {});

    const raceResults = [];
    for (const race of season.results) {
      const raceId = raceIds.get(`2026-${race.round}`);
      if (!raceId) continue;
      for (const r of race.results) {
        const driverId = driverIds.get(r.driverExternalId);
        if (!driverId) continue;
        raceResults.push({
          raceId,
          driverId,
          teamId: teamIds.get(r.teamExternalId) || null,
          position: r.position,
          points: r.points,
          grid: r.grid,
          fastestLap: r.fastestLap,
          sessionType: r.sessionType || 'race',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
    await queryInterface.bulkInsert('race_results', raceResults, {});
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('race_results', null, {});
    await queryInterface.bulkDelete('season_teams', null, {});
    await queryInterface.bulkDelete('races', null, {});
    await queryInterface.bulkDelete('teams', null, {});
    await queryInterface.bulkDelete('drivers', null, {});
    await queryInterface.bulkDelete('users', null, {});
  },
};
