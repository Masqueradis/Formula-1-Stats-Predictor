'use strict';

require('../config/env');

const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { Team, Driver, Race, SeasonTeam, RaceResult, sequelize } = require('../models');
const { TEAM_META } = require('../data/teamMeta');
const { refreshActiveFlags } = require('../services/f1SyncService');
const { invalidateApiCache } = require('../cache/invalidate');

const DEFAULT_DIR = '/tmp/opencode/jolpica-csv';
const DEFAULT_START = 2021;
const DEFAULT_END = 2025;

function num(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function text(value, max) {
  const s = value == null ? '' : String(value);
  return max ? s.slice(0, max) : s;
}

function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    if (quoted) {
      if (ch === '"' && content[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field.replace(/\r$/, ''));
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    if (row.some((v) => v !== '')) rows.push(row);
  }
  const [header, ...data] = rows;
  return data.map((values) => {
    const obj = {};
    header.forEach((key, idx) => { obj[key] = values[idx] === undefined ? '' : values[idx]; });
    return obj;
  });
}

function loadTable(dir, name) {
  const file = path.join(dir, `formula_one_${name}.csv`);
  if (!fs.existsSync(file)) throw new Error(`dump table not found: ${file}`);
  return parseCsv(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function indexBy(rows, key) {
  const map = new Map();
  for (const row of rows) map.set(row[key], row);
  return map;
}

function baseAbbreviation(raw) {
  const source = String(raw || 'DRV');
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

async function run() {
  const dir = process.argv[2] || DEFAULT_DIR;
  const start = Number(process.argv[3] || DEFAULT_START);
  const end = Number(process.argv[4] || DEFAULT_END);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
    throw new Error(`invalid season range: ${start}..${end}`);
  }

  console.log(`[dump] directory=${dir} seasons=${start}..${end}`);
  const seasons = loadTable(dir, 'season');
  const circuits = indexBy(loadTable(dir, 'circuit'), 'id');
  const teams = indexBy(loadTable(dir, 'team'), 'id');
  const drivers = indexBy(loadTable(dir, 'driver'), 'id');
  const rounds = loadTable(dir, 'round');
  const teamDrivers = indexBy(loadTable(dir, 'teamdriver'), 'id');
  const roundEntries = indexBy(loadTable(dir, 'roundentry'), 'id');
  const sessions = loadTable(dir, 'session');
  const sessionEntries = loadTable(dir, 'sessionentry');

  const seasonYear = new Map();
  for (const s of seasons) {
    const year = Number(s.year);
    if (year >= start && year <= end) seasonYear.set(s.id, year);
  }
  if (!seasonYear.size) throw new Error(`no seasons found in dump for ${start}..${end}`);

  const roundsInScope = rounds.filter((r) => seasonYear.has(r.season_id));
  const roundIds = new Set(roundsInScope.map((r) => r.id));
  const sessionsInScope = sessions.filter(
    (s) => roundIds.has(s.round_id) && (s.type === 'R' || s.type === 'SR'),
  );
  const sessionIds = new Set(sessionsInScope.map((s) => s.id));
  const entriesInScope = sessionEntries.filter((e) => sessionIds.has(e.session_id));
  const roundEntryIds = new Set(entriesInScope.map((e) => e.round_entry_id));
  const teamDriverIds = new Set(
    [...roundEntryIds].map((id) => roundEntries.get(id)?.team_driver_id).filter(Boolean),
  );
  for (const td of teamDrivers.values()) {
    if (seasonYear.has(td.season_id)) teamDriverIds.add(td.id);
  }

  console.log(
    `[dump] rounds=${roundsInScope.length} sessions=${sessionsInScope.length} ` +
      `entries=${entriesInScope.length} teamDrivers=${teamDriverIds.size}`,
  );

  const teamCache = new Map();
  const driverCache = new Map();

  const ensureTeam = async (ref) => {
    if (!ref) return null;
    if (teamCache.has(ref)) return teamCache.get(ref);
    const raw = [...teams.values()].find((t) => t.reference === ref) || {};
    const meta = TEAM_META[ref] || {};
    const values = {
      externalId: ref,
      name: meta.name || raw.name || ref,
      nationality: meta.nationality || raw.nationality || null,
      principal: meta.principal || null,
      url: meta.url || null,
      color: meta.color || null,
    };
    let team = await Team.findOne({ where: { externalId: ref } });
    if (team) {
      await team.update(values);
    } else {
      team = await Team.findOne({ where: { name: values.name } });
      if (team) {
        await team.update({ ...values, externalId: ref });
      } else {
        team = await Team.create(values);
      }
    }
    teamCache.set(ref, team);
    return team;
  };

  const ensureDriver = async (ref) => {
    if (!ref) return null;
    if (driverCache.has(ref)) return driverCache.get(ref);
    const raw = [...drivers.values()].find((d) => d.reference === ref) || {};
    const values = {
      externalId: ref,
      firstName: text(raw.forename || 'Unknown', 100),
      lastName: text(raw.surname || ref, 100),
      number: num(raw.permanent_car_number) ?? 0,
      nationality: text(raw.nationality || 'Unknown', 100),
      dateOfBirth: raw.date_of_birth || null,
    };
    let driver = await Driver.findOne({ where: { externalId: ref } });
    if (driver) {
      await driver.update(values);
    } else {
      const base = baseAbbreviation(raw.surname || ref);
      driver = await Driver.create({ ...values, abbreviation: await uniqueAbbreviation(base), podiums: 0 });
    }
    driverCache.set(ref, driver);
    return driver;
  };

  for (const td of teamDrivers.values()) {
    if (!teamDriverIds.has(td.id)) continue;
    if (teams.get(td.team_id)?.reference) await ensureTeam(teams.get(td.team_id).reference);
    if (drivers.get(td.driver_id)?.reference) await ensureDriver(drivers.get(td.driver_id).reference);
  }

  const raceById = new Map();
  for (const round of roundsInScope) {
    const season = seasonYear.get(round.season_id);
    const roundNumber = Number(round.number);
    const circuit = circuits.get(round.circuit_id) || {};
    const values = {
      externalId: `${season}-${roundNumber}`,
      name: text(round.name, 200),
      circuit: text(circuit.name, 200) || null,
      country: text(circuit.country, 100) || null,
      date: round.date || null,
      season,
      round: roundNumber,
      trackLatitude: num(circuit.latitude),
      trackLongitude: num(circuit.longitude),
    };
    let race = await Race.findOne({ where: { externalId: values.externalId } });
    if (!race) race = await Race.findOne({ where: { season, round: roundNumber } });
    if (race) {
      await race.update({ ...values, status: 'finished' });
    } else {
      race = await Race.create({ ...values, status: 'finished' });
    }
    raceById.set(round.id, race);
  }

  let seasonTeams = 0;
  for (const tdId of teamDriverIds) {
    const td = teamDrivers.get(tdId);
    if (!td || !seasonYear.has(td.season_id)) continue;
    const team = await ensureTeam(teams.get(td.team_id)?.reference);
    const driver = await ensureDriver(drivers.get(td.driver_id)?.reference);
    if (!team || !driver) continue;
    await SeasonTeam.findOrCreate({
      where: { season: seasonYear.get(td.season_id), teamId: team.id, driverId: driver.id },
      defaults: {
        season: seasonYear.get(td.season_id),
        teamId: team.id,
        driverId: driver.id,
        isReserve: /reserve/i.test(td.role || ''),
      },
    });
    seasonTeams += 1;
  }

  const entriesBySession = new Map();
  for (const entry of entriesInScope) {
    if (!entriesBySession.has(entry.session_id)) entriesBySession.set(entry.session_id, []);
    entriesBySession.get(entry.session_id).push(entry);
  }
  let results = 0;
  for (const session of sessionsInScope) {
    const race = raceById.get(session.round_id);
    if (!race) continue;
    const sessionType = session.type === 'SR' ? 'sprint' : 'race';
    const rows = [];
    for (const entry of entriesBySession.get(session.id) || []) {
      const roundEntry = roundEntries.get(entry.round_entry_id);
      const td = teamDrivers.get(roundEntry?.team_driver_id);
      if (!td) continue;
      const driver = await ensureDriver(drivers.get(td.driver_id)?.reference);
      const team = await ensureTeam(teams.get(td.team_id)?.reference);
      if (!driver) continue;
      const position = num(entry.position);
      const detail = text(entry.detail, 50) || null;
      const positionText = position !== null
        ? String(position)
        : detail === 'Disqualified' ? 'D' : entry.is_classified === 'f' ? 'R' : null;
      rows.push({
        raceId: race.id,
        driverId: driver.id,
        teamId: team?.id || null,
        position,
        points: num(entry.points) ?? 0,
        grid: num(entry.grid),
        fastestLap: entry.fastest_lap_rank === '1',
        sessionType,
        positionText,
        status: detail,
        time: text(entry.time, 20) || null,
        laps: num(entry.laps_completed),
      });
    }
    // eslint-disable-next-line no-await-in-loop
    await sequelize.transaction(async (transaction) => {
      await RaceResult.destroy({ where: { raceId: race.id, sessionType }, transaction });
      if (rows.length) await RaceResult.bulkCreate(rows, { transaction });
    });
    results += rows.length;
  }

  const active = await refreshActiveFlags();
  await invalidateApiCache();

  console.log('[dump] totals:', JSON.stringify({
    races: raceById.size,
    results,
    seasonTeams,
    teams: teamCache.size,
    drivers: driverCache.size,
    active,
  }));
}

run()
  .catch((err) => {
    console.error('[dump] failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
