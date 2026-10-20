'use strict';

const { Team, Driver, Race, SeasonTeam, RaceResult } = require('../models');
const { TEAM_META } = require('../data/teamMeta');
const jolpica = require('../clients/jolpicaClient');

function today() {
  return new Date().toISOString().slice(0, 10);
}

function raceExternalId(season, round) {
  return `${season}-${round}`;
}

function standingsFrom(payload) {
  const lists = payload?.MRData?.StandingsTable?.StandingsLists || [];
  return lists[0] || {};
}

function resultsFrom(payload) {
  const races = payload?.MRData?.RaceTable?.Races || [];
  return races[0]?.Results || races[0]?.SprintResults || [];
}

function locationOf(circuit) {
  const location = circuit?.Location || {};
  const lat = location.lat != null ? Number(location.lat) : null;
  const long = location.long != null ? Number(location.long) : null;
  return {
    country: location.country || null,
    trackLatitude: Number.isFinite(lat) ? lat : null,
    trackLongitude: Number.isFinite(long) ? long : null,
  };
}

function normalizeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function syncSeason(rawSeason, options = {}) {
  const season = Number(rawSeason) || Number(options.season) || new Date().getFullYear();
  const summary = { season, teams: 0, drivers: 0, races: 0, results: 0, seasonTeams: 0, errors: [] };
  // Гонки, у которых статус реально изменился (scheduled ↔ finished) — для live-push
  const statusChanges = [];

  const [schedulePayload, constructorsPayload, driversPayload, standingsPayload, sprintPayload] =
    await Promise.all([
      jolpica.getJson(`/${season}/?limit=100`),
      jolpica.getJson(`/${season}/constructors/?limit=100`),
      jolpica.getJson(`/${season}/drivers/?limit=100`),
      jolpica.getJson(`/${season}/driverstandings/?limit=100`),
      jolpica.getJson(`/${season}/sprint/?limit=100`),
    ]);

  const schedule = schedulePayload?.MRData?.RaceTable?.Races || [];
  const constructors = constructorsPayload?.MRData?.ConstructorTable?.Constructors || [];
  const drivers = driversPayload?.MRData?.DriverTable?.Drivers || [];
  const standings = standingsFrom(standingsPayload).DriverStandings || [];
  const sprintRounds = new Set(
    (sprintPayload?.MRData?.RaceTable?.Races || []).map((r) => Number(r.round)),
  );

  const teamByExternal = new Map();
  const driverByExternal = new Map();
  const raceByRound = new Map();

  const ensureTeam = async (raw) => {
    const externalId = raw.constructorId;
    if (!externalId) return null;
    if (teamByExternal.has(externalId)) return teamByExternal.get(externalId);

    const meta = TEAM_META[externalId] || {};
    const values = {
      externalId,
      name: meta.name || raw.name,
      nationality: meta.nationality || raw.nationality || null,
      principal: meta.principal || null,
      url: meta.url || null,
      color: meta.color || null,
    };

    let team = await Team.findOne({ where: { externalId } });
    if (team) {
      await team.update(values);
    } else {
      try {
        team = await Team.create(values);
      } catch (err) {
        team = await Team.findOne({ where: { name: values.name } });
        if (!team) throw err;
        if (!team.externalId) await team.update({ externalId });
      }
    }
    teamByExternal.set(externalId, team);
    summary.teams += 1;
    return team;
  };

  const ensureDriver = async (raw) => {
    const externalId = raw.driverId;
    if (!externalId) return null;
    if (driverByExternal.has(externalId)) return driverByExternal.get(externalId);

    const abbreviation = (raw.code || raw.familyName || '???').slice(0, 3).toUpperCase();
    const values = {
      externalId,
      firstName: raw.givenName || raw.firstName,
      lastName: raw.familyName || raw.lastName,
      abbreviation,
      number: normalizeNumber(raw.permanentNumber),
      nationality: raw.nationality || 'Unknown',
      dateOfBirth: raw.dateOfBirth || null,
    };

    let driver = await Driver.findOne({ where: { externalId } });
    if (driver) {
      await driver.update(values);
    } else {
      driver = await Driver.findOne({ where: { abbreviation } });
      if (driver) {
        await driver.update(values);
      } else {
        driver = await Driver.create({ ...values, podiums: 0 });
      }
    }
    driverByExternal.set(externalId, driver);
    summary.drivers += 1;
    return driver;
  };

  for (const constructor of constructors) {
    await ensureTeam(constructor);
  }

  // Jolpica отдаёт и тест-пилотов без номера/кода — в ростере оставляем только боевых
  for (const driver of drivers.filter((d) => d.permanentNumber && d.code)) {
    await ensureDriver(driver);
  }

  const todayStr = today();
  for (const race of schedule) {
    const round = Number(race.round);
    const externalId = raceExternalId(season, round);
    const values = {
      externalId,
      name: race.raceName,
      circuit: race.Circuit?.circuitName || null,
      date: race.date || null,
      season,
      round,
      ...locationOf(race.Circuit),
    };

    let record = await Race.findOne({ where: { externalId } });
    if (!record) {
      record = await Race.findOne({ where: { season, round } });
    }
    if (record) {
      await record.update(values);
    } else {
      const status = race.date && race.date < todayStr ? 'finished' : 'scheduled';
      record = await Race.create({ ...values, status });
    }
    raceByRound.set(round, record);
    summary.races += 1;
  }

  const podiumByDriver = new Map();
  const seasonTeamPairs = [];
  const seenPairs = new Set();

  const addSeasonTeamPair = (driverExternalId, teamExternalId) => {
    if (!driverExternalId || !teamExternalId) return;
    const key = `${driverExternalId}:${teamExternalId}`;
    if (seenPairs.has(key)) return;
    seenPairs.add(key);
    seasonTeamPairs.push({ driverExternalId, teamExternalId });
  };

  for (const race of schedule) {
    const round = Number(race.round);
    const raceRecord = raceByRound.get(round);
    if (!raceRecord) continue;
    if (race.date && race.date > todayStr) continue;

    let resultPayload;
    try {
      resultPayload = await jolpica.getJson(`/${season}/${round}/results/?limit=100`);
    } catch (err) {
      summary.errors.push(`results ${season}/${round}: ${err.message}`);
      continue;
    }
    const raceResults = resultsFrom(resultPayload);

    let sprintResults = [];
    if (sprintRounds.has(round)) {
      try {
        const sprintPayload = await jolpica.getJson(`/${season}/${round}/sprint/?limit=100`);
        sprintResults = resultsFrom(sprintPayload);
      } catch (err) {
        summary.errors.push(`sprint ${season}/${round}: ${err.message}`);
      }
    }

    const rows = [];
    const collect = async (list, sessionType) => {
      const limit = sessionType === 'sprint' ? 8 : 10;
      for (const item of list) {
        if (Number(item.position) > limit && normalizeNumber(item.points) <= 0) continue;
        const driver = await ensureDriver(item.Driver);
        const team = await ensureTeam(item.Constructor);
        if (!driver || !team) continue;
        addSeasonTeamPair(item.Driver.driverId, item.Constructor.constructorId);
        if (sessionType === 'race' && Number(item.position) <= 3) {
          podiumByDriver.set(driver.id, (podiumByDriver.get(driver.id) || 0) + 1);
        }
        rows.push({
          raceId: raceRecord.id,
          driverId: driver.id,
          teamId: team.id,
          position: Number(item.position),
          points: normalizeNumber(item.points),
          grid: item.grid != null ? Number(item.grid) : null,
          fastestLap: sessionType === 'race' && item.FastestLap?.rank === '1',
          sessionType,
        });
      }
    };

    await collect(raceResults, 'race');
    await collect(sprintResults, 'sprint');

    await RaceResult.destroy({ where: { raceId: raceRecord.id } });
    if (rows.length) {
      await RaceResult.bulkCreate(rows);
      summary.results += rows.length;
    }

    const status = rows.some((r) => r.sessionType === 'race') ? 'finished' : raceRecord.status;
    if (raceRecord.status !== status) {
      const previous = raceRecord.status;
      await raceRecord.update({ status });
      // Live-push о смене статуса гонки (лаба 7): только при реальном изменении
      statusChanges.push({ raceId: raceRecord.id, externalId: raceRecord.externalId, name: raceRecord.name, previous, status });
    }
  }

  for (const standing of standings) {
    addSeasonTeamPair(
      standing.Driver?.driverId,
      standing.Constructors?.[0]?.constructorId,
    );
  }

  for (const pair of seasonTeamPairs) {
    const driver = driverByExternal.get(pair.driverExternalId);
    const team = teamByExternal.get(pair.teamExternalId);
    if (!driver || !team) continue;
    await SeasonTeam.findOrCreate({
      where: { season, teamId: team.id, driverId: driver.id },
      defaults: { season, teamId: team.id, driverId: driver.id },
    });
    summary.seasonTeams += 1;
  }

  for (const [driverId, podiums] of podiumByDriver.entries()) {
    await Driver.update({ podiums }, { where: { id: driverId } });
  }

  summary.statusChanges = statusChanges;
  return summary;
}

module.exports = { syncSeason, raceExternalId };
