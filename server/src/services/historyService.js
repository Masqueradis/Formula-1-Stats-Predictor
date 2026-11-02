'use strict';

const { Race, RaceResult, Driver, Team, sequelize } = require('../models');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function parseSeason(raw) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1950 || value > 2100) {
    throw httpError(400, 'season must be a valid year');
  }
  return value;
}

function parseId(raw) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw httpError(400, 'Invalid id');
  return value;
}

function driverDto(driver) {
  if (!driver) return null;
  return {
    id: driver.id,
    firstName: driver.firstName,
    lastName: driver.lastName,
    abbreviation: driver.abbreviation,
    number: driver.number,
  };
}

function teamDto(team) {
  if (!team) return null;
  return { id: team.id, name: team.name, color: team.color };
}

function resultDto(row) {
  return {
    id: row.id,
    position: row.position,
    positionText: row.positionText,
    driver: driverDto(row.driver),
    team: teamDto(row.team),
    grid: row.grid,
    laps: row.laps,
    time: row.time,
    status: row.status,
    points: Number(row.points || 0),
    fastestLap: Boolean(row.fastestLap),
    sessionType: row.sessionType,
  };
}

function byPosition(a, b) {
  const pa = a.position ?? Number.MAX_SAFE_INTEGER;
  const pb = b.position ?? Number.MAX_SAFE_INTEGER;
  return pa - pb || a.id - b.id;
}

const RESULT_INCLUDES = [
  { association: 'driver' },
  { association: 'team' },
];

/** Список сезонов с числом гонок и границами дат — для селекторов история/зачёты. */
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

/** Карточки гонок сезона: победитель + подиум (полная классификация — в деталке). */
async function getRaces(rawSeason) {
  const season = parseSeason(rawSeason);
  const races = await Race.findAll({
    where: { season },
    include: [{ model: RaceResult, as: 'results', include: RESULT_INCLUDES }],
    order: [['round', 'ASC']],
  });

  return {
    season,
    races: races.map((race) => {
      const raceRows = (race.results || [])
        .filter((row) => (row.sessionType || 'race') === 'race')
        .map(resultDto)
        .sort(byPosition);
      const podium = raceRows.slice(0, 3).map((row) => ({
        position: row.position,
        driver: row.driver,
        team: row.team,
      }));
      return {
        id: race.id,
        round: race.round,
        name: race.name,
        circuit: race.circuit,
        country: race.country,
        date: race.date,
        status: race.status,
        winner: podium[0] || null,
        podium,
      };
    }),
  };
}

/** Полная классификация гонки + спринт (если был). */
async function getRace(rawId) {
  const id = parseId(rawId);
  const race = await Race.findByPk(id, {
    include: [{ model: RaceResult, as: 'results', include: RESULT_INCLUDES }],
  });
  if (!race) throw httpError(404, 'race not found');

  const rows = (race.results || []).map(resultDto);
  return {
    race: {
      id: race.id,
      season: race.season,
      round: race.round,
      name: race.name,
      circuit: race.circuit,
      country: race.country,
      date: race.date,
      status: race.status,
    },
    results: {
      race: rows.filter((row) => row.sessionType !== 'sprint').sort(byPosition),
      sprint: rows.filter((row) => row.sessionType === 'sprint').sort(byPosition),
    },
  };
}

module.exports = { getSeasons, getRaces, getRace };
