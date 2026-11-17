'use strict';

const probabilityRepository = require('../repositories/probabilityRepository');

const WEIGHTS = Object.freeze({
  P_qual: 0.35,
  F_driver: 0.3,
  F_team: 0.2,
  H_track: 0.15,
});

const NEUTRAL = 0.5;
const POSITION_SCALE = 20;
const FORM_RACES = 5;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function positionScore(position) {
  const p = Number(position);
  if (!Number.isFinite(p) || p < 1) return null;
  return Math.max(0, Math.min(1, 1 - (p - 1) / POSITION_SCALE));
}

function average(values) {
  if (values.length === 0) return NEUTRAL;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function blendAverage(current, previous, currentWeight = 1) {
  const hasCurrent = Number.isFinite(current);
  const hasPrevious = Number.isFinite(previous);

  if (!hasCurrent && !hasPrevious) return { value: NEUTRAL, source: 'neutral' };
  if (!hasPrevious) return { value: current, source: 'current' };
  if (!hasCurrent) return { value: previous, source: 'previous' };

  const weight = Math.max(0, Math.min(1, Number(currentWeight)));
  if (weight >= 1) return { value: current, source: 'current' };
  if (weight <= 0) return { value: previous, source: 'previous' };
  return { value: weight * current + (1 - weight) * previous, source: 'blended' };
}

function formSourceFor(currentCount, previousCount) {
  if (currentCount > 0 && previousCount > 0) return 'blended';
  if (currentCount > 0) return 'current';
  if (previousCount > 0) return 'previous';
  return 'neutral';
}

function raceOrderKey(row) {
  const date = row.race && row.race.date ? String(row.race.date) : '';
  const round = row.race && Number.isFinite(Number(row.race.round)) ? Number(row.race.round) : 0;
  return `${date}#${String(round).padStart(4, '0')}`;
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function softmax(scores) {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => (e / sum) * 100);
}

function distributePercentages(values, digits = 2) {
  const factor = 10 ** digits;
  const target = 100 * factor;
  const scaled = values.map((value) => Math.max(0, Number(value) || 0) * factor);
  const cents = scaled.map((value) => Math.floor(value));

  let remainder = target - cents.reduce((sum, value) => sum + value, 0);
  const byFraction = scaled
    .map((value, index) => ({ index, fraction: value - cents[index] }))
    .sort((a, b) => b.fraction - a.fraction);

  let cursor = 0;
  while (remainder > 0 && byFraction.length > 0) {
    cents[byFraction[cursor % byFraction.length].index] += 1;
    remainder -= 1;
    cursor += 1;
  }
  while (remainder < 0) {
    const richest = cents.indexOf(Math.max(...cents));
    if (richest === -1 || cents[richest] <= 0) break;
    cents[richest] -= 1;
    remainder += 1;
  }

  return cents.map((value) => value / factor);
}

function groupByDriver(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.driverId)) map.set(row.driverId, []);
    map.get(row.driverId).push(row);
  }
  return map;
}

function teamPoints(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!row.teamId) continue;
    map.set(row.teamId, (map.get(row.teamId) || 0) + Number(row.points || 0));
  }
  return map;
}

function distinctRaceCount(rows) {
  return new Set(
    rows.filter((r) => (r.sessionType || 'race') === 'race').map((r) => r.raceId),
  ).size;
}

function normalizeTeamScore(points, max) {
  if (!max || max <= 0) return null;
  return Math.max(0, Math.min(1, points / max));
}

function lastRaceGrid(seasonResults) {
  const rows = (seasonResults || []).filter(
    (r) => (r.sessionType || 'race') === 'race' && r.race,
  );
  if (!rows.length) return null;

  const lastRace = rows.reduce((best, r) => {
    const date = String(r.race.date || '');
    const bestDate = String(best.race.date || '');
    if (date !== bestDate) return date > bestDate ? r : best;
    return (Number(r.race.round) || 0) > (Number(best.race.round) || 0) ? r : best;
  });

  const lastRaceId = lastRace.raceId ?? lastRace.race.id;
  const grid = new Map();
  for (const r of rows) {
    if ((r.raceId ?? r.race.id) !== lastRaceId) continue;
    const driverId = Number(r.driverId ?? r.driver?.id);
    if (!Number.isFinite(driverId) || grid.has(driverId)) continue;
    grid.set(driverId, r.teamId == null ? null : Number(r.teamId));
  }
  return grid.size ? grid : null;
}

async function getNextProbabilities() {
  const race = await probabilityRepository.findNextRace();
  if (!race) throw httpError(404, 'No upcoming race scheduled');

  const previousSeason = race.season - 1;

  const [roster, seasonResults, previousResults, circuitResults] = await Promise.all([
    probabilityRepository.findRoster(race.season),
    probabilityRepository.findSeasonResults(race.season),
    probabilityRepository.findSeasonResults(previousSeason),
    probabilityRepository.findCircuitResults(race.circuit),
  ]);

  const seasonByDriver = groupByDriver(seasonResults);
  const previousByDriver = groupByDriver(previousResults);

  const teamPointsCurrent = teamPoints(seasonResults);
  const teamPointsPrevious = teamPoints(previousResults);
  const maxTeamPoints = Math.max(0, ...teamPointsCurrent.values());
  const maxTeamPointsPrevious = Math.max(0, ...teamPointsPrevious.values());

  const currentRaceCount = distinctRaceCount(seasonResults);
  const previousRaceCount = distinctRaceCount(previousResults);

  const circuitByDriver = groupByDriver(circuitResults);

  const grid = lastRaceGrid(seasonResults);
  const sortedRoster = Array.isArray(roster)
    ? [...roster].sort((a, b) => {
        const reserveDiff = Number(a.isReserve === true) - Number(b.isReserve === true);
        if (reserveDiff !== 0) return reserveDiff;
        return Number(a.id || 0) - Number(b.id || 0);
      })
    : roster;
  const candidatesByDriver = new Map();
  for (const st of sortedRoster) {
    const driver = st.driver;
    const team = st.team;
    if (!driver || driver.isActive === false) continue;
    if (!team || team.isActive === false) continue;
    if (!candidatesByDriver.has(driver.id)) candidatesByDriver.set(driver.id, []);
    candidatesByDriver.get(driver.id).push({ driver, team });
  }
  const rosterByDriver = new Map();
  for (const [driverId, options] of candidatesByDriver) {
    if (grid && !grid.has(driverId)) continue;
    const gridTeamId = grid ? grid.get(driverId) : null;
    const chosen = gridTeamId != null
      ? options.find(({ team }) => team.id === gridTeamId)
      : null;
    rosterByDriver.set(driverId, chosen || options[0]);
  }

  const drivers = [];
  for (const { driver, team } of rosterByDriver.values()) {
    const seasonRows = seasonByDriver.get(driver.id) || [];
    const raceRows = seasonRows.filter((r) => (r.sessionType || 'race') === 'race');
    const previousRows = (previousByDriver.get(driver.id) || []).filter(
      (r) => (r.sessionType || 'race') === 'race',
    );

    const grids = raceRows.map((r) => positionScore(r.grid)).filter((v) => v !== null);
    const previousGrids = previousRows.map((r) => positionScore(r.grid)).filter((v) => v !== null);
    const pQual = blendAverage(
      grids.length > 0 ? averageOrNull(grids) : null,
      previousGrids.length > 0 ? averageOrNull(previousGrids) : null,
      grids.length / FORM_RACES,
    );

    const recent = [...raceRows]
      .filter((r) => positionScore(r.position) !== null)
      .sort((a, b) => raceOrderKey(b).localeCompare(raceOrderKey(a)))
      .slice(0, FORM_RACES);
    const recentPrevious = [...previousRows]
      .filter((r) => positionScore(r.position) !== null)
      .sort((a, b) => raceOrderKey(b).localeCompare(raceOrderKey(a)))
      .slice(0, FORM_RACES);
    const form = blendAverage(
      recent.length > 0 ? averageOrNull(recent.map((r) => positionScore(r.position))) : null,
      recentPrevious.length > 0
        ? averageOrNull(recentPrevious.map((r) => positionScore(r.position)))
        : null,
      recent.length / FORM_RACES,
    );

    const teamCurrent = teamPointsCurrent.has(team.id)
      ? normalizeTeamScore(teamPointsCurrent.get(team.id), maxTeamPoints)
      : null;
    const teamPrevious = teamPointsPrevious.has(team.id)
      ? normalizeTeamScore(teamPointsPrevious.get(team.id), maxTeamPointsPrevious)
      : null;
    const teamForm = blendAverage(
      teamCurrent,
      teamPrevious,
      currentRaceCount / FORM_RACES,
    );

    const history = (circuitByDriver.get(driver.id) || [])
      .filter((r) => (r.sessionType || 'race') === 'race')
      .map((r) => positionScore(r.position))
      .filter((v) => v !== null);
    const hTrack = history.length > 0 ? average(history) : NEUTRAL;

    const features = {
      P_qual: pQual.value,
      F_driver: form.value,
      F_team: teamForm.value,
      H_track: hTrack,
    };
    const score = Object.entries(WEIGHTS)
      .reduce((sum, [key, w]) => sum + w * features[key], 0);

    drivers.push({
      id: driver.id,
      firstName: driver.firstName,
      lastName: driver.lastName,
      abbreviation: driver.abbreviation,
      number: driver.number,
      team: { id: team.id, name: team.name, color: team.color },
      formSource: form.source,
      features: {
        P_qual: round(features.P_qual, 3),
        F_driver: round(features.F_driver, 3),
        F_team: round(features.F_team, 3),
        H_track: round(features.H_track, 3),
      },
      score: round(score, 4),
      probability: 0,
    });
  }

  const probabilities = softmax(drivers.map((d) => d.score));
  const percentages = distributePercentages(probabilities);
  drivers.forEach((d, i) => {
    d.probability = percentages[i];
  });
  drivers.sort((a, b) => b.probability - a.probability || a.lastName.localeCompare(b.lastName));

  const usesPreviousSeason = drivers.some(
    (d) => d.formSource === 'previous' || d.formSource === 'blended',
  );

  return {
    race: {
      id: race.id,
      name: race.name,
      circuit: race.circuit,
      country: race.country,
      date: race.date,
      season: race.season,
      round: race.round,
    },
    weights: WEIGHTS,
    scale: POSITION_SCALE,
    basis: {
      currentRaces: currentRaceCount,
      previousRaces: previousRaceCount,
      previousSeason,
      formWindow: FORM_RACES,
      usesPreviousSeason,
      gridFromLastRace: grid ? grid.size : 0,
    },
    drivers,
  };
}

function averageOrNull(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

module.exports = {
  getNextProbabilities,
  WEIGHTS,
  softmax,
  distributePercentages,
  positionScore,
  average,
  blendAverage,
  formSourceFor,
  FORM_RACES,
};
