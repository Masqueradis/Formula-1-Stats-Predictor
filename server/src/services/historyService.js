'use strict';

/**
 * Эпик-10: история Гран-при (2000–2025) на данных PostgreSQL.
 * Отдаёт сезоны, карточки гонок и полную классификацию; standings —
 * существующий /api/standings?season=...
 */

const { Race, RaceResult, sequelize } = require('../models');
const { parseId } = require('./crudService');

const RESULT_INCLUDES = [
  { model: RaceResult, as: 'results', include: [{ association: 'driver' }, { association: 'team' }] },
];

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function normalizeSeason(rawSeason) {
  const season = Number(rawSeason);
  if (!Number.isInteger(season) || season < 1950) {
    throw badRequest('season must be a valid year');
  }
  return season;
}

function toJson(record) {
  return typeof record.toJSON === 'function' ? record.toJSON() : record;
}

function resultView(row) {
  const driver = row.driver || {};
  const team = row.team || {};
  return {
    position: row.position,
    positionText: row.positionText || (row.position == null ? 'R' : String(row.position)),
    driver: {
      id: driver.id,
      firstName: driver.firstName,
      lastName: driver.lastName,
      abbreviation: driver.abbreviation,
    },
    team: team.id
      ? { id: team.id, name: team.name, color: team.color || null }
      : null,
    grid: row.grid,
    laps: row.laps,
    time: row.time,
    status: row.status,
    points: Number(row.points || 0),
    fastestLap: Boolean(row.fastestLap),
  };
}

function sortResults(rows) {
  return [...rows].sort((a, b) => {
    const pa = a.position == null ? Number.MAX_SAFE_INTEGER : a.position;
    const pb = b.position == null ? Number.MAX_SAFE_INTEGER : b.position;
    return pa - pb || String(a.driver?.lastName || '').localeCompare(String(b.driver?.lastName || ''));
  });
}

function podiumOf(rows) {
  return sortResults(rows.filter((row) => row.sessionType === 'race' && row.position))
    .slice(0, 3)
    .map(resultView);
}

function raceCard(race) {
  const json = toJson(race);
  const results = json.results || [];
  const raceRows = results.filter((row) => (row.sessionType || 'race') === 'race');
  const podium = podiumOf(raceRows);
  return {
    id: json.id,
    season: json.season,
    round: json.round,
    name: json.name,
    circuit: json.circuit,
    country: json.country,
    date: json.date,
    status: json.status,
    winner: podium[0]?.driver || null,
    podium,
  };
}

async function getSeasons() {
  const rows = await Race.findAll({
    attributes: [
      'season',
      [sequelize.fn('COUNT', sequelize.col('id')), 'races'],
      [sequelize.fn('MIN', sequelize.col('date')), 'firstDate'],
      [sequelize.fn('MAX', sequelize.col('date')), 'lastDate'],
    ],
    group: ['season'],
    order: [['season', 'DESC']],
    raw: true,
  });

  return rows.map((row) => ({
    season: Number(row.season),
    races: Number(row.races),
    firstDate: row.firstDate,
    lastDate: row.lastDate,
  }));
}

async function getRaces(rawSeason) {
  const season = normalizeSeason(rawSeason);
  const races = await Race.findAll({
    where: { season },
    include: RESULT_INCLUDES,
    order: [['round', 'ASC']],
  });
  return { season, races: races.map(raceCard) };
}

async function getRace(rawId) {
  const id = parseId(rawId);
  if (id === null) throw badRequest('Invalid race id');

  const race = await Race.findByPk(id, { include: RESULT_INCLUDES });
  if (!race) {
    const err = new Error('race not found');
    err.status = 404;
    throw err;
  }

  const json = toJson(race);
  const results = json.results || [];
  const raceRows = sortResults(results.filter((row) => (row.sessionType || 'race') === 'race')).map(resultView);
  const sprintRows = sortResults(results.filter((row) => row.sessionType === 'sprint')).map(resultView);

  return {
    race: {
      id: json.id,
      season: json.season,
      round: json.round,
      name: json.name,
      circuit: json.circuit,
      country: json.country,
      date: json.date,
      status: json.status,
    },
    results: { race: raceRows, sprint: sprintRows },
  };
}

module.exports = { getSeasons, getRaces, getRace };
