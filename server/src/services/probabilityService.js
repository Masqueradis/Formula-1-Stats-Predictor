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

  const [roster, seasonResults, circuitResults] = await Promise.all([
    probabilityRepository.findRoster(race.season),
    probabilityRepository.findSeasonResults(race.season),
    probabilityRepository.findCircuitResults(race.circuit),
  ]);

  // Индексы результатов
  const seasonByDriver = new Map();
  for (const row of seasonResults) {
    if (!seasonByDriver.has(row.driverId)) seasonByDriver.set(row.driverId, []);
    seasonByDriver.get(row.driverId).push(row);
  }

  const teamPoints = new Map();
  for (const row of seasonResults) {
    if (!row.teamId) continue;
    teamPoints.set(row.teamId, (teamPoints.get(row.teamId) || 0) + Number(row.points || 0));
  }
  const maxTeamPoints = Math.max(0, ...teamPoints.values());

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

    // P_qual: средняя стартовая позиция сезона
    const grids = raceRows.map((r) => positionScore(r.grid)).filter((v) => v !== null);
    const pQual = grids.length > 0 ? average(grids) : NEUTRAL;

    // F_driver: последние FORM_RACES гонок
    const recent = [...raceRows]
      .filter((r) => positionScore(r.position) !== null)
      .sort((a, b) => raceOrderKey(b).localeCompare(raceOrderKey(a)))
      .slice(0, FORM_RACES);
    const form = average(recent.map((r) => positionScore(r.position)));

    // F_team: доли очков команды в сезоне
    const teamScore = maxTeamPoints > 0
      ? Math.max(0, Math.min(1, (teamPoints.get(team.id) || 0) / maxTeamPoints))
      : NEUTRAL;

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
    drivers,
  };
}

// softmax/positionScore/average — чистые функции, экспортируются для unit-тестов (эпик-09)
module.exports = { getNextProbabilities, WEIGHTS, softmax, positionScore, average };
