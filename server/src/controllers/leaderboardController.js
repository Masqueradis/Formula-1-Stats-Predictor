'use strict';

const leaderboardService = require('../services/leaderboardService');
const apiResponse = require('../utils/apiResponse');

async function getLeaderboard(req, res) {
  try {
    const limit = Number(req.query.limit) || 50;
    const data = await leaderboardService.getLeaderboard(limit);
    return apiResponse.success(res, data);
  } catch (err) {
    return apiResponse.error(res, err.message, err.status || 500);
  }
}

module.exports = { getLeaderboard };
