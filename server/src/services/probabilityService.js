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
 *              поэтому используется средняя стартовая позиция пилота в сезоне (grid).
 * - F_driver — текущая форма: средний финиш по последним 5 гонкам сезона (sessionType=race).
 * - F_team   — форма команды: очки команды в сезоне / максимум очков среди команд.
 * - H_track  — историческая успешность на автодроме гонки (все сезоны).
 *
 * Эпик-10: в начале сезона текущих данных мало, поэтому P_qual/F_driver/F_team
 * подмешивают прошлый сезон (blendAverage). Вес текущих данных растёт с числом
 * гонок: после FORM_RACES гонок прошлый сезон перестаёт влиять.
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
 * Взвешенное смешивание текущего и прошлого сезона.
 * currentWeight ∈ [0; 1] — доля текущих данных (0 = только прошлый сезон).
 * Возвращает { value, source }, где source: current | previous | blended | neutral.
 */
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

/** Softmax с вычитом максимума (эквивалентно формуле, защищает от переполнения). */
function softmax(scores) {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => (e / sum) * 100);
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

  // Индексы результатов
  const seasonByDriver = groupByDriver(seasonResults);
  const previousByDriver = groupByDriver(previousResults);

  const teamPointsCurrent = teamPoints(seasonResults);
  const teamPointsPrevious = teamPoints(previousResults);
  const maxTeamPoints = Math.max(0, ...teamPointsCurrent.values());
  const maxTeamPointsPrevious = Math.max(0, ...teamPointsPrevious.values());

  const currentRaceCount = distinctRaceCount(seasonResults);
  const previousRaceCount = distinctRaceCount(previousResults);

  const circuitByDriver = groupByDriver(circuitResults);

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
    const previousRows = (previousByDriver.get(driver.id) || []).filter(
      (r) => (r.sessionType || 'race') === 'race',
    );

    // P_qual: средняя стартовая позиция сезона (+ прошлый сезон при нехватке данных)
    const grids = raceRows.map((r) => positionScore(r.grid)).filter((v) => v !== null);
    const previousGrids = previousRows.map((r) => positionScore(r.grid)).filter((v) => v !== null);
    const pQual = blendAverage(
      grids.length > 0 ? averageOrNull(grids) : null,
      previousGrids.length > 0 ? averageOrNull(previousGrids) : null,
      grids.length / FORM_RACES,
    );

    // F_driver: последние FORM_RACES гонок текущего и прошлого сезона
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

    // F_team: доля очков команды в сезоне (+ прошлый сезон как fallback)
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

    // H_track: финиши на этом автодроме (все сезоны, включая историю)
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
      probability: 0, // заполняется после softmax
    });
  }

  const probabilities = softmax(drivers.map((d) => d.score));
  drivers.forEach((d, i) => {
    d.probability = round(probabilities[i], 2);
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
    },
    drivers,
  };
}

// Утилита среднего без нейтрального приора: null, если данных нет.
function averageOrNull(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// softmax/positionScore/average/blendAverage — чистые функции, экспортируются для unit-тестов.
module.exports = {
  getNextProbabilities,
  WEIGHTS,
  softmax,
  positionScore,
  average,
  blendAverage,
  formSourceFor,
  FORM_RACES,
};
