'use strict';

const predictionService = require('../services/predictionService');
const apiResponse = require('../utils/apiResponse');

function fail(res, err) {
  return apiResponse.error(res, err.message, err.status || 500);
}

async function getAll(req, res) {
  try {
    return apiResponse.success(res, await predictionService.getAll());
  } catch (err) {
    return fail(res, err);
  }
}

async function getNext(req, res) {
  try {
    return apiResponse.success(res, await predictionService.getNext());
  } catch (err) {
    return fail(res, err);
  }
}

async function getStats(req, res) {
  try {
    return apiResponse.success(res, await predictionService.getStats(req.query.raceId));
  } catch (err) {
    return fail(res, err);
  }
}

async function getByRace(req, res) {
  try {
    return apiResponse.success(res, await predictionService.getByRaceId(req.params.raceId));
  } catch (err) {
    return fail(res, err);
  }
}

async function createVote(req, res) {
  try {
    const doc = await predictionService.createVote(req.params.raceId, req.user, req.body);
    return apiResponse.success(res, doc);
  } catch (err) {
    return fail(res, err);
  }
}

async function updateVote(req, res) {
  try {
    const doc = await predictionService.updateVote(req.params.raceId, req.params.userId, req.user, req.body);
    return apiResponse.success(res, doc);
  } catch (err) {
    return fail(res, err);
  }
}

async function removeVote(req, res) {
  try {
    const doc = await predictionService.removeVote(
      req.params.raceId,
      req.params.userId,
      req.user,
      req.query.kind,
    );
    return apiResponse.success(res, doc);
  } catch (err) {
    return fail(res, err);
  }
}

async function createComment(req, res) {
  try {
    const doc = await predictionService.createComment(req.params.raceId, req.user, req.body);
    return apiResponse.created(res, doc);
  } catch (err) {
    return fail(res, err);
  }
}

async function removeComment(req, res) {
  try {
    const doc = await predictionService.removeComment(req.params.raceId, req.params.commentId, req.user);
    return apiResponse.success(res, doc);
  } catch (err) {
    return fail(res, err);
  }
}

async function toggleLike(req, res) {
  try {
    const doc = await predictionService.toggleLike(req.params.raceId, req.params.commentId, req.user);
    return apiResponse.success(res, doc);
  } catch (err) {
    return fail(res, err);
  }
}

async function remove(req, res) {
  try {
    const deleted = await predictionService.removeRaceDoc(req.params.raceId);
    return apiResponse.success(res, deleted);
  } catch (err) {
    return fail(res, err);
  }
}

module.exports = {
  getAll,
  getNext,
  getStats,
  getByRace,
  createVote,
  updateVote,
  removeVote,
  createComment,
  removeComment,
  toggleLike,
  remove,
};
