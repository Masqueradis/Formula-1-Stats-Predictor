'use strict';

const { syncSeason } = require('../services/f1SyncService');
const apiResponse = require('../utils/apiResponse');

async function syncF1(req, res) {
  const season = Number(req.body?.season) || Number(process.env.SYNC_SEASON) || new Date().getFullYear();
  try {
    const summary = await syncSeason(season);
    return apiResponse.success(res, summary);
  } catch (err) {
    return apiResponse.error(res, 'F1 sync failed', 502, err.message);
  }
}

module.exports = { syncF1 };
