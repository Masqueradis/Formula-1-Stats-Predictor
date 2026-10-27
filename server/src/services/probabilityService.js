'use strict';

const probabilityRepository = require('../repositories/probabilityRepository');

/**
 * Phase 4 / US-4 — алгоритм прогнозирования (Softmax).
 *
 * Базовый рейтинг пилота на ближайший Гран-при:
 *   S_i = w1·P_qual + w2·F_driver + w3·F_team + w4·H_track
 * все компоненты нормированы в [0; 1], затем
 *   P(i) = e^{S_i} / Σ e^{S_j}   (умножается на 100 → проценты)
 *
 * Компоненты:
 * - P_qual   — стартовая позиция. Квалификация ближайшей гонки ещё не проводилась,
 *              поэтому используется средняя стартовая позиция пилота в сезоне (grid);
 *              при нехватке текущих гонок — средняя grid прошлого сезона.
 * - F_driver — текущая форма: средний финиш по последним 5 гонкам сезона (sessionType=race);
 *              при нехватке — форма прошлого сезона (блендинг по количеству гонок).
 * - F_team   — форма команды: очки команды в сезоне / максимум очков среди команд;
 *              в начале сезона — доля очков прошлого сезона.
 * - H_track  — историческая успешность на автодроме гонки (все сезоны).
 *
 * Перевод позиции p в оценку: score = 1 - (p-1)/20 (обрезается в [0; 1]).
 * Если данных нет (сезон не начался / дебют на трассе) — нейтральный приор 0.5.
 */

const WEIGHTS = Object.freeze({
  P_qual: 0.35,
  F_driver: 0.3,
  F_team: 0.2,
  H_track: 0.15,
});

const NEUTRAL = 0.5;
const POSITION_SCALE = 20; // шкала «поле ~20 пилотов»
const FORM_RACES = 5; // последние N гонок для F_driver
const QUALI_RACES = 3; // окно недавних квалификаций для P_qual
const TEAM_BLEND_RACES = 3; // окно текущего сезона для F_team

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

/**
 * Смешивает среднее текущего сезона с прошлым сезоном.
 * Если текущих гонок меньше window, недостающая доля берётся из прошлого сезона.
 * Если данных нет ни там, ни там — нейтральный приор 0.5.
 */
function blendAverage(currentValues, previousValues, window) {
  const current = average(currentValues);
  const previous = average(previousValues);
  const weight = Math.min(1, currentValues.length / Math.max(1, window));
  return weight * current + (1 - weight) * previous;
}

function formSourceFor(currentCount, window, hasPrevious) {
  if (currentCount >= window) return 'current';
  if (currentCount === 0) return hasPrevious ? 'previous' : 'neutral';
  return hasPrevious ? 'blended' : 'current';
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

/** Softmax с вычитом максимума (эквивалентно формуле, защищает от переполнения). */
function softmax(scores) {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => (e / sum) * 100);
}

async function getNextProbabilities() {
  const race = await probabilityRepository.findNextRace();
  if (!race) throw httpError(404, 'No upcoming race scheduled');

  const [roster, seasonResults, previousResults, circuitResults] = await Promise.all([
    probabilityRepository.findRoster(race.season),
    probabilityRepository.findSeasonResults(race.season),
    probabilityRepository.findSeasonResults(race.season - 1),
    probabilityRepository.findCircuitResults(race.circuit),
  ]);

  // Индексы результатов
  const seasonByDriver = new Map();
  for (const row of seasonResults) {
    if (!seasonByDriver.has(row.driverId)) seasonByDriver.set(row.driverId, []);
    seasonByDriver.get(row.driverId).push(row);
  }

  const previousByDriver = new Map();
  for (const row of previousResults) {
    if (!previousByDriver.has(row.driverId)) previousByDriver.set(row.driverId, []);
    previousByDriver.get(row.driverId).push(row);
  }

  const teamPoints = new Map();
  for (const row of seasonResults) {
    if (!row.teamId) continue;
    teamPoints.set(row.teamId, (teamPoints.get(row.teamId) || 0) + Number(row.points || 0));
  }
  const maxTeamPoints = Math.max(0, ...teamPoints.values());

  const previousTeamPoints = new Map();
  for (const row of previousResults) {
    if (!row.teamId) continue;
    previousTeamPoints.set(row.teamId, (previousTeamPoints.get(row.teamId) || 0) + Number(row.points || 0));
  }
  const previousMaxTeamPoints = Math.max(0, ...previousTeamPoints.values());

  const currentRaces = new Set(
    seasonResults.filter((r) => (r.sessionType || 'race') === 'race').map((r) => r.raceId),
  ).size;
  const previousRaces = new Set(
    previousResults.filter((r) => (r.sessionType || 'race') === 'race').map((r) => r.raceId),
  ).size;

  const circuitByDriver = new Map();
  for (const row of circuitResults) {
    if (!circuitByDriver.has(row.driverId)) circuitByDriver.set(row.driverId, []);
    circuitByDriver.get(row.driverId).push(row);
  }

  // У пилота может быть несколько строк состава за сезон (напр. Lawson 2026: Racing Bulls + Red Bull) —
  // дедуплицируем по driverId, команда берётся из последней строки (roster отсортирован по id ASC),
  // как это делает standingsService.
  const rosterByDriver = new Map();
  for (const st of roster) {
    const driver = st.driver;
    const team = st.team;
    if (!driver || driver.isActive === false) continue;
    if (!team || team.isActive === false) continue;
    rosterByDriver.set(driver.id, { driver, team });
  }

  const drivers = [];
  for (const { driver, team } of rosterByDriver.values()) {
    const seasonRows = seasonByDriver.get(driver.id) || [];
    const raceRows = seasonRows.filter((r) => (r.sessionType || 'race') === 'race');
    const previousRows = previousByDriver.get(driver.id) || [];
    const previousRaceRows = previousRows.filter((r) => (r.sessionType || 'race') === 'race');

    // P_qual: средняя стартовая позиция сезона, при нехватке — прошлый сезон
    const grids = raceRows.map((r) => positionScore(r.grid)).filter((v) => v !== null);
    const previousGrids = previousRaceRows.map((r) => positionScore(r.grid)).filter((v) => v !== null);
    const pQual = blendAverage(grids, previousGrids, QUALI_RACES);

    // F_driver: последние FORM_RACES гонок; в начале сезона — форма прошлого сезона
    const recent = [...raceRows]
      .filter((r) => positionScore(r.position) !== null)
      .sort((a, b) => raceOrderKey(b).localeCompare(raceOrderKey(a)))
      .slice(0, FORM_RACES);
    const previousForm = previousRaceRows
      .map((r) => positionScore(r.position))
      .filter((v) => v !== null);
    const form = blendAverage(recent.map((r) => positionScore(r.position)), previousForm, FORM_RACES);

    // F_team: доля очков команды в сезоне; при отсутствии данных — прошлый сезон
    const currentTeamScore = maxTeamPoints > 0
      ? Math.max(0, Math.min(1, (teamPoints.get(team.id) || 0) / maxTeamPoints))
      : null;
    const previousTeamScore = previousMaxTeamPoints > 0 && previousTeamPoints.has(team.id)
      ? Math.max(0, Math.min(1, previousTeamPoints.get(team.id) / previousMaxTeamPoints))
      : null;
    let teamScore = NEUTRAL;
    if (currentTeamScore !== null && previousTeamScore !== null) {
      const teamWeight = Math.min(1, currentRaces / TEAM_BLEND_RACES);
      teamScore = teamWeight * currentTeamScore + (1 - teamWeight) * previousTeamScore;
    } else if (currentTeamScore !== null) {
      teamScore = currentTeamScore;
    } else if (previousTeamScore !== null) {
      teamScore = previousTeamScore;
    }

    // H_track: финиши на этом автодроме (все сезоны)
    const history = (circuitByDriver.get(driver.id) || [])
      .filter((r) => (r.sessionType || 'race') === 'race')
      .map((r) => positionScore(r.position))
      .filter((v) => v !== null);
    const hTrack = history.length > 0 ? average(history) : NEUTRAL;

    const features = { P_qual: pQual, F_driver: form, F_team: teamScore, H_track: hTrack };
    const score = Object.entries(WEIGHTS)
      .reduce((sum, [key, w]) => sum + w * features[key], 0);

    drivers.push({
      id: driver.id,
      firstName: driver.firstName,
      lastName: driver.lastName,
      abbreviation: driver.abbreviation,
      number: driver.number,
      team: { id: team.id, name: team.name, color: team.color },
      features: {
        P_qual: round(features.P_qual, 3),
        F_driver: round(features.F_driver, 3),
        F_team: round(features.F_team, 3),
        H_track: round(features.H_track, 3),
      },
      score: round(score, 4),
      formSource: formSourceFor(recent.length, FORM_RACES, previousForm.length > 0),
      probability: 0, // заполняется после softmax
    });
  }

  const probabilities = softmax(drivers.map((d) => d.score));
  drivers.forEach((d, i) => {
    d.probability = round(probabilities[i], 2);
  });
  drivers.sort((a, b) => b.probability - a.probability || a.lastName.localeCompare(b.lastName));

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
      currentRaces,
      previousRaces,
      previousSeason: race.season - 1,
      formWindow: FORM_RACES,
      usesPreviousSeason: drivers.some((d) => ['previous', 'blended'].includes(d.formSource)),
    },
    drivers,
  };
}

// Чистые функции экспортируются для unit-тестов (эпик-09/10).
module.exports = {
  getNextProbabilities,
  WEIGHTS,
  softmax,
  positionScore,
  average,
  blendAverage,
  formSourceFor,
};
