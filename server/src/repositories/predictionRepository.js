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
async function addVote(raceId, vote) {
  return RacePredictionDoc.findOneAndUpdate(
    { raceId, 'votes.userId': { $ne: vote.userId } },
    { $push: { votes: vote } },
    { returnDocument: 'after' },
  ).exec();
}

/** Обновление элемента массива позиционным оператором $ (часть 6 задания) */
async function updateVote(raceId, userId, { kind, picks }) {
  return RacePredictionDoc.findOneAndUpdate(
    { raceId, 'votes.userId': userId },
    {
      $set: {
        'votes.$.kind': kind,
        'votes.$.picks': picks,
        'votes.$.updatedAt': new Date(),
      },
    },
    { returnDocument: 'after' },
  ).exec();
}

async function removeVote(raceId, userId) {
  return RacePredictionDoc.findOneAndUpdate(
    { raceId, 'votes.userId': userId },
    { $pull: { votes: { userId } } },
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
};
