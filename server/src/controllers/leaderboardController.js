'use strict';

const leaderboardService = require('../services/leaderboardService');
const apiResponse = require('../utils/apiResponse');
const { clampInt } = require('../utils/queryParams');

async function getLeaderboard(req, res) {
  try {
    // BUG-20: limit ограничен сверху, чтобы один запрос не тянул всю коллекцию.
    const limit = clampInt(req.query.limit, { min: 1, max: 100, fallback: 50 });
    const data = await leaderboardService.getLeaderboard(limit);
    return apiResponse.success(res, data);
  } catch (err) {
    return apiResponse.error(res, err.message, err.status || 500);
  }
}

module.exports = { getLeaderboard };
