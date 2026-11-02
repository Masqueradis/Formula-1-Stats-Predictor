'use strict';

const RacePredictionDoc = require('../models/mongo/racePredictionDoc');

/**
 * Работа с MongoDB (Mongoose) — слой репозитория.
 * Атомарные операции с вложенными массивами: $push, $set с позиционным
 * оператором "$", $pull, $addToSet (см. контрольные вопросы 6, 7, 11).
 */

async function findAll(sort = { season: -1, round: -1 }) {
  return RacePredictionDoc.find().sort(sort).exec();
}

async function findByRaceId(raceId) {
  return RacePredictionDoc.findOne({ raceId }).exec();
}

async function create(data) {
  return RacePredictionDoc.create(data);
}

/** Массовый $set изменяемых полей документа (снапшот гонки и состава entries) */
async function setFields(raceId, fields) {
  return RacePredictionDoc.findOneAndUpdate(
    { raceId },
    { $set: fields },
    { returnDocument: 'after' },
  ).exec();
}

/** findOneAndDelete — возвращает удалённый документ (вопрос 12) */
async function removeByRaceId(raceId) {
  return RacePredictionDoc.findOneAndDelete({ raceId }).exec();
}

/**
 * Атомарное добавление голоса: условие `'votes.userId': { $ne }` гарантирует,
 * что при конкурентных запросах не появятся два голоса одного пользователя
 * (проверка-then-insert не атомарна — здесь источник истины сам update).
 * null → дубль голоса.
 */
/**
 * Голос пользователя. Уникальность — пара (userId, kind): один народный ('full')
 * И один личный ТОП-3 ('top3') на гонку (US-5), чтобы фичи не конфликтовали.
 */
async function addVote(raceId, vote) {
  return RacePredictionDoc.findOneAndUpdate(
    {
      raceId,
      votes: { $not: { $elemMatch: { userId: vote.userId, kind: vote.kind } } },
    },
    { $push: { votes: vote } },
    { returnDocument: 'after' },
  ).exec();
}

/** Обновление элемента массива позиционным оператором $ (часть 6 задания).
 *  kind в условии — иначе positional $ взял бы первый vote пользователя не того типа. */
async function updateVote(raceId, userId, { kind, picks }) {
  // Фильтрованный позиционный $[v], а не голый $: у юзера может быть ДВА голоса
  // (full + top3, US-5), и обычный $ на части серверов выбирает первый элемент,
  // совпадающий лишь по userId — правился чужой голос (поймано тестом эпик-09).
  return RacePredictionDoc.findOneAndUpdate(
    { raceId, 'votes.userId': userId, 'votes.kind': kind },
    {
      $set: {
        'votes.$[v].kind': kind,
        'votes.$[v].picks': picks,
        'votes.$[v].updatedAt': new Date(),
      },
    },
    {
      arrayFilters: [{ 'v.userId': userId, 'v.kind': kind }],
      returnDocument: 'after',
    },
  ).exec();
}

/** kind опционален: без него удаляются все голоса пользователя (старое поведение API) */
async function removeVote(raceId, userId, kind) {
  const filter = { userId };
  if (kind) filter.kind = kind;
  return RacePredictionDoc.findOneAndUpdate(
    { raceId, 'votes.userId': userId },
    { $pull: { votes: filter } },
    { returnDocument: 'after' },
  ).exec();
}

async function addComment(raceId, comment) {
  return RacePredictionDoc.findOneAndUpdate(
    { raceId },
    { $push: { comments: comment } },
    { returnDocument: 'after' },
  ).exec();
}

async function removeComment(raceId, commentId) {
  return RacePredictionDoc.findOneAndUpdate(
    { raceId },
    { $pull: { comments: { _id: commentId } } },
    { returnDocument: 'after' },
  ).exec();
}

/**
 * $addToSet — добавление в массив без дублей (лайк).
 * ВАЖНО: условия на поля одного элемента comments объединяются через $elemMatch —
 * без него `'comments.likes': { $ne }` проверялся бы по ВСЕМ комментариям документа,
 * и после лайка любого комментария лайкнуть следующий было бы невозможно (404).
 */
async function addLike(raceId, commentId, userId) {
  return RacePredictionDoc.findOneAndUpdate(
    { raceId, comments: { $elemMatch: { _id: commentId, likes: { $ne: userId } } } },
    { $addToSet: { 'comments.$.likes': userId } },
    { returnDocument: 'after' },
  ).exec();
}

async function removeLike(raceId, commentId, userId) {
  return RacePredictionDoc.findOneAndUpdate(
    { raceId, comments: { $elemMatch: { _id: commentId, likes: userId } } },
    { $pull: { 'comments.$.likes': userId } },
    { returnDocument: 'after' },
  ).exec();
}

/**
 * Aggregation pipeline: народный рейтинг по пилотам.
 * $unwind votes → $unwind picks → $group (avg/min/max position) → $sort.
 */
async function aggregateStats(match = {}) {
  return RacePredictionDoc.aggregate([
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    { $unwind: '$votes' },
    // Народный рейтинг — только 'full'-голоса; личные ТОП-3 (US-5) в нём не участвуют
    { $match: { 'votes.kind': 'full' } },
    { $unwind: '$votes.picks' },
    {
      $group: {
        _id: '$votes.picks.driverId',
        avgPosition: { $avg: '$votes.picks.position' },
        bestPosition: { $min: '$votes.picks.position' },
        worstPosition: { $max: '$votes.picks.position' },
        votesCount: { $sum: 1 },
        raceIds: { $addToSet: '$raceId' },
      },
    },
    // _id (driverId) — детерминированный tie-break: без него строки с равным avgPosition
    // возвращаются в произвольном порядке и «прыгают» при каждом refetch (баг сессии02)
    { $sort: { avgPosition: 1, votesCount: -1, _id: 1 } },
  ]).exec();
}

/**
 * UC-2: записать баллы голосов завершённой гонки (bulkWrite).
 * entries: [{ userId, kind, score, exactHits, podiumHits }]
 * Фильтрованный $[v] вместо голого $ — см. комментарий в updateVote (full+top3 у юзера).
 */
async function applyVoteScores(raceId, entries) {
  if (!entries.length) return null;
  const ops = entries.map((entry) => ({
    updateOne: {
      filter: { raceId, 'votes.userId': entry.userId, 'votes.kind': entry.kind },
      update: {
        $set: {
          'votes.$[v].score': entry.score,
          'votes.$[v].exactHits': entry.exactHits,
          'votes.$[v].podiumHits': entry.podiumHits,
          'votes.$[v].scoredAt': new Date(),
        },
      },
      arrayFilters: [{ 'v.userId': entry.userId, 'v.kind': entry.kind }],
    },
  }));
  return RacePredictionDoc.bulkWrite(ops);
}

/**
 * US-6: рейтинг предсказателей — $unwind votes → отбор оценённых → $group по
 * userId (сумма баллов, число прогнозов, точные места, попадания в ТОП-3).
 */
async function aggregateLeaderboard(limit = 50) {
  return RacePredictionDoc.aggregate([
    { $unwind: '$votes' },
    { $match: { 'votes.score': { $ne: null } } },
    {
      $group: {
        _id: '$votes.userId',
        points: { $sum: '$votes.score' },
        predictions: { $sum: 1 },
        exactHits: { $sum: { $ifNull: ['$votes.exactHits', 0] } },
        podiumHits: { $sum: { $ifNull: ['$votes.podiumHits', 0] } },
        lastUsername: { $last: '$votes.username' }, // fallback, если пользователя больше нет в PG
      },
    },
    // Баллы → точные места → ТОП-3 → userId: детерминированный порядок без «прыжков»
    { $sort: { points: -1, exactHits: -1, podiumHits: -1, _id: 1 } },
    { $limit: Math.max(1, Math.min(Number(limit) || 50, 200)) },
  ]).exec();
}

/** Сколько пользователей вообще есть с оценёнными голосами (для total). */
async function countLeaderboardParticipants() {
  const rows = await RacePredictionDoc.aggregate([
    { $unwind: '$votes' },
    { $match: { 'votes.score': { $ne: null } } },
    { $group: { _id: '$votes.userId' } },
    { $count: 'total' },
  ]).exec();
  return rows[0]?.total || 0;
}

module.exports = {
  findAll,
  findByRaceId,
  create,
  setFields,
  removeByRaceId,
  addVote,
  updateVote,
  removeVote,
  addComment,
  removeComment,
  addLike,
  removeLike,
  aggregateStats,
  applyVoteScores,
  aggregateLeaderboard,
  countLeaderboardParticipants,
};
