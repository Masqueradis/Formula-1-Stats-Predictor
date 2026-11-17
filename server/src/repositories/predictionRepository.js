'use strict';

const RacePredictionDoc = require('../models/mongo/racePredictionDoc');

async function findAll(sort = { season: -1, round: -1 }) {
  return RacePredictionDoc.find().sort(sort).exec();
}

async function findByRaceId(raceId) {
  return RacePredictionDoc.findOne({ raceId }).exec();
}

async function create(data) {
  return RacePredictionDoc.create(data);
}

async function setFields(raceId, fields) {
  return RacePredictionDoc.findOneAndUpdate(
    { raceId },
    { $set: fields },
    { returnDocument: 'after' },
  ).exec();
}

async function removeByRaceId(raceId) {
  return RacePredictionDoc.findOneAndDelete({ raceId }).exec();
}

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

async function updateVote(raceId, userId, { kind, picks }) {
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

async function aggregateStats(match = {}) {
  return RacePredictionDoc.aggregate([
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    { $unwind: '$votes' },
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
    { $sort: { avgPosition: 1, votesCount: -1, _id: 1 } },
  ]).exec();
}

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
        lastUsername: { $last: '$votes.username' },
      },
    },
    { $sort: { points: -1, exactHits: -1, podiumHits: -1, _id: 1 } },
    { $limit: Math.max(1, Math.min(Number(limit) || 50, 200)) },
  ]).exec();
}

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
