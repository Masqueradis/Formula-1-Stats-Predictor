'use strict';

const { syncSeason } = require('../services/f1SyncService');
const driverService = require('../services/driverService');
const teamService = require('../services/teamService');
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

async function getDrivers(req, res) {
  try {
    const { search, teamId } = req.query;
    const data = await driverService.getAll({ search, teamId, includeInactive: true });
    return apiResponse.success(res, data);
  } catch (err) {
    return apiResponse.error(res, err.message, 500);
  }
}

async function getTeams(req, res) {
  try {
    const data = await teamService.getAll({ includeInactive: true });
    return apiResponse.success(res, data);
  } catch (err) {
    return apiResponse.error(res, err.message, 500);
  }
}

module.exports = { syncF1, getDrivers, getTeams };
