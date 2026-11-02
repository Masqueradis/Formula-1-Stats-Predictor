'use strict';

const { Op } = require('sequelize');
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

function optionalNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Эпик-10: у старых сезонов (2000–2014) Jolpica не отдаёт `code`/`permanentNumber`.
 * Аббревиатура строится из первых трёх букв фамилии, коллизии получают числовой
 * суффикс (столбец — STRING(3)), поэтому аббревиатура остаётся трёхсимвольной.
 */
function baseAbbreviation(raw) {
  const source = String(raw.code || raw.familyName || raw.lastName || 'DRV');
  const cleaned = source.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  return (cleaned || 'DRV').padEnd(3, 'X');
}

async function uniqueAbbreviation(base) {
  if (!(await Driver.findOne({ where: { abbreviation: base } }))) return base;
  for (let i = 2; i <= 999; i += 1) {
    const suffix = String(i);
    const candidate = `${base.slice(0, Math.max(0, 3 - suffix.length))}${suffix}`.slice(-3);
    if (!(await Driver.findOne({ where: { abbreviation: candidate } }))) return candidate;
  }
  throw new Error(`cannot generate unique abbreviation for ${base}`);
}

/** Опциональные эндпоинты (sprint/drivers/standings) у старых сезонов могут 404 — не валим синк. */
async function safeGet(path) {
  try {
    return await jolpica.getJson(path);
  } catch {
    return null;
  }
}

/**
 * Пересчёт флага isActive по последнему сезону, который есть в season_teams:
 * активны только участники последнего сезона, остальные (исторические) — архив.
 * Ручные записи без строк в season_teams не трогаются.
 */
async function refreshActiveFlags() {
  const latestSeason = await SeasonTeam.max('season');
  if (!latestSeason) return { season: null, drivers: 0, teams: 0 };

  const latest = await SeasonTeam.findAll({
    where: { season: latestSeason },
    attributes: ['driverId', 'teamId'],
  });
  const activeDriverIds = [...new Set(latest.map((row) => row.driverId))].filter(Boolean);
  const activeTeamIds = [...new Set(latest.map((row) => row.teamId))].filter(Boolean);

  const all = await SeasonTeam.findAll({ attributes: ['driverId', 'teamId'] });
  const allDriverIds = [...new Set(all.map((row) => row.driverId))].filter(Boolean);
  const allTeamIds = [...new Set(all.map((row) => row.teamId))].filter(Boolean);

  const inactiveDriverIds = allDriverIds.filter((id) => !activeDriverIds.includes(id));
  const inactiveTeamIds = allTeamIds.filter((id) => !activeTeamIds.includes(id));

  if (activeDriverIds.length) {
    await Driver.update({ isActive: true }, { where: { id: { [Op.in]: activeDriverIds } } });
  }
  if (activeTeamIds.length) {
    await Team.update({ isActive: true }, { where: { id: { [Op.in]: activeTeamIds } } });
  }
  if (inactiveDriverIds.length) {
    await Driver.update({ isActive: false }, { where: { id: { [Op.in]: inactiveDriverIds } } });
  }
  if (inactiveTeamIds.length) {
    await Team.update({ isActive: false }, { where: { id: { [Op.in]: inactiveTeamIds } } });
  }

  return {
    season: latestSeason,
    drivers: activeDriverIds.length,
    teams: activeTeamIds.length,
  };
}

async function syncSeason(rawSeason, options = {}) {
  const season = Number(rawSeason) || Number(options.season) || new Date().getFullYear();
  const summary = { season, teams: 0, drivers: 0, races: 0, results: 0, seasonTeams: 0, errors: [] };
  // Гонки, у которых статус реально изменился (scheduled ↔ finished) — для live-push
  const statusChanges = [];

  const schedulePayload = await jolpica.getJson(`/${season}/?limit=100`);
  const [constructorsPayload, driversPayload, standingsPayload, sprintPayload] =
    await Promise.all([
      safeGet(`/${season}/constructors/?limit=100`),
      safeGet(`/${season}/drivers/?limit=100`),
      safeGet(`/${season}/driverstandings/?limit=100`),
      safeGet(`/${season}/sprint/?limit=100`),
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

    const values = {
      externalId,
      firstName: raw.givenName || raw.firstName || 'Unknown',
      lastName: raw.familyName || raw.lastName || externalId,
      number: normalizeNumber(raw.permanentNumber),
      nationality: raw.nationality || 'Unknown',
      dateOfBirth: raw.dateOfBirth || null,
    };

    let driver = await Driver.findOne({ where: { externalId } });
    if (driver) {
      // podiums не трогаем: это агрегат, который пересчитывается отдельно
      await driver.update(values);
    } else {
      // Старые сезоны без `code`: пробуем привязаться к ручной/сидовой записи
      // по аббревиатуре, но только если у неё ещё нет externalId.
      const code = raw.code ? baseAbbreviation(raw) : null;
      if (code) {
        const byCode = await Driver.findOne({ where: { abbreviation: code } });
        if (byCode && !byCode.externalId) {
          driver = await byCode;
          await driver.update(values);
        }
      }
      if (!driver) {
        const abbreviation = await uniqueAbbreviation(baseAbbreviation(raw));
        driver = await Driver.create({ ...values, abbreviation, podiums: 0 });
      }
    }
    driverByExternal.set(externalId, driver);
    summary.drivers += 1;
    return driver;
  };

  for (const constructor of constructors) {
    await ensureTeam(constructor);
  }

  // Эпик-10: исторические пилоты часто без permanentNumber/code — их тоже заводим
  for (const driver of drivers) {
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
      const sprintPayloadForRound = await safeGet(`/${season}/${round}/sprint/?limit=100`);
      sprintResults = resultsFrom(sprintPayloadForRound);
    }

    const rows = [];
    const collect = async (list, sessionType) => {
      for (const item of list) {
        const driver = await ensureDriver(item.Driver);
        const team = await ensureTeam(item.Constructor);
        if (!driver || !team) continue;
        addSeasonTeamPair(item.Driver.driverId, item.Constructor.constructorId);

        const position = optionalNumber(item.position);
        if (sessionType === 'race' && position !== null && position >= 1 && position <= 3) {
          podiumByDriver.set(driver.id, (podiumByDriver.get(driver.id) || 0) + 1);
        }
        rows.push({
          raceId: raceRecord.id,
          driverId: driver.id,
          teamId: team.id,
          position,
          points: normalizeNumber(item.points),
          grid: item.grid != null ? Number(item.grid) : null,
          fastestLap: sessionType === 'race' && String(item.FastestLap?.rank) === '1',
          sessionType,
          // Эпик-10: полная классификация — позиция текстом (R, D, W, NC…),
          // статус (Finished, +1 Lap, Accident…), время и число кругов.
          positionText: item.positionText != null ? String(item.positionText) : null,
          status: item.status || null,
          time: item.Time?.time || null,
          laps: optionalNumber(item.laps),
        });
      }
    };

    // Полная классификация: раньше брали только топ-10/очковых, теперь — все строки
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

  // Подиумы — агрегат текущего сезона (в исторических сезонах не перезаписываем,
  // иначе синк 2000-2025 обнулит актуальные значения).
  if (season === new Date().getFullYear()) {
    for (const [driverId, podiums] of podiumByDriver.entries()) {
      await Driver.update({ podiums }, { where: { id: driverId } });
    }
  }

  if (options.refreshActive !== false) {
    summary.active = await refreshActiveFlags();
  }

  summary.statusChanges = statusChanges;
  return summary;
}

module.exports = { syncSeason, refreshActiveFlags, raceExternalId };
