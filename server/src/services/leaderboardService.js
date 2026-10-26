'use strict';

/**
 * US-6 + UC-2 — рейтинг предсказателей (leaderboard) и начисление баллов.
 *
 * Данные: голоса в MongoDB (`race_prediction_docs.votes`), фактические результаты
 * в PostgreSQL (`race_results`) — кросс-БД, поэтому join делается в коде сервиса.
 *
 * Правило подсчёта баллов (UC-2), одинаково для kind='full' и kind='top3':
 * - за каждый pick: предсказанное место == фактическому  → +3 (точное место);
 * - иначе: предсказан на ТОП-3 (position ≤ 3) И пилот реально финишировал
 *   в ТОП-3 (≤ 3), но с другим местом → +1;
 * - пилот не финишировал / нет результата → 0.
 *
 * Оценка идемпотентна: cron пересчитывает все завершённые гонки целиком
 * (исправления результатов подхватятся), неизменённые голоса не перезаписываются.
 */

const raceRepository = require('../repositories/raceRepository');
const raceResultRepository = require('../repositories/raceResultRepository');
const userRepository = require('../repositories/userRepository');
const predictionRepository = require('../repositories/predictionRepository');

const RULES = Object.freeze({ exact: 3, podium: 1 });

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/** Поиск гонки в PostgreSQL по externalId (ключ Mongo) или по числовому id — как в predictionService */
async function resolveRace(rawRaceId) {
  if (!rawRaceId) return null;
  const byExternal = await raceRepository.findOne({ externalId: String(rawRaceId) });
  if (byExternal) return byExternal;
  const id = Number(rawRaceId);
  return Number.isInteger(id) && id > 0 ? raceRepository.findById(id) : null;
}

/** Баллы одного голоса: { score, exactHits, podiumHits } */
function scoreVote(vote, positionByDriver) {
  let score = 0;
  let exactHits = 0;
  let podiumHits = 0;

  for (const pick of vote.picks || []) {
    const actual = positionByDriver.get(pick.driverId);
    if (!actual || actual < 1) continue; // не финишировал / нет данных
    if (pick.position === actual) {
      score += RULES.exact;
      exactHits += 1;
    } else if (pick.position <= 3 && actual <= 3) {
      score += RULES.podium;
      podiumHits += 1;
    }
  }

  return { score, exactHits, podiumHits };
}

/**
 * Пересчитать баллы всех голосов на завершённые гонки.
 * @returns {{ races: number, votes: number }} сколько гонок обработано и баллов записано
 */
async function recalculate() {
  const docs = await predictionRepository.findAll({ season: -1, round: -1 });

  let races = 0;
  let votes = 0;

  for (const doc of docs) {
    if (!doc.votes || doc.votes.length === 0) continue;

    const race = await resolveRace(doc.raceId);
    if (!race || race.status !== 'finished') continue;

    const results = await raceResultRepository.findAll({
      where: { raceId: race.id, sessionType: 'race' },
    });
    if (results.length === 0) continue;

    const positionByDriver = new Map();
    for (const row of results) {
      const pos = Number(row.position);
      if (Number.isFinite(pos) && pos >= 1) positionByDriver.set(row.driverId, pos);
    }

    const updates = [];
    for (const vote of doc.votes) {
      const scored = scoreVote(vote, positionByDriver);
      if ((vote.score ?? null) !== scored.score) {
        updates.push({ userId: vote.userId, kind: vote.kind, ...scored });
      }
    }

    if (updates.length > 0) {
      await predictionRepository.applyVoteScores(doc.raceId, updates);
      races += 1;
      votes += updates.length;
    }
  }

  return { races, votes };
}

/**
 * Текущий рейтинг: агрегация из Mongo + актуальные username из PostgreSQL
 * (удалённые пользователи отфильтровываются, nickname берётся свежий).
 */
async function getLeaderboard(limit = 50) {
  const [rows, total, users] = await Promise.all([
    predictionRepository.aggregateLeaderboard(limit),
    predictionRepository.countLeaderboardParticipants(),
    userRepository.findAll({ attributes: ['id', 'username'] }),
  ]);

  const usernameById = new Map(users.map((u) => [u.id, u.username]));
  const present = rows
    .filter((row) => usernameById.has(row._id))
    .map((row, index) => ({
      rank: index + 1,
      userId: row._id,
      username: usernameById.get(row._id),
      points: row.points,
      predictions: row.predictions,
      exactHits: row.exactHits,
      podiumHits: row.podiumHits,
    }));

  return { rules: RULES, total, users: present };
}

module.exports = { recalculate, getLeaderboard, scoreVote, RULES };
