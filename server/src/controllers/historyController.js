'use strict';

const historyService = require('../services/historyService');
const apiResponse = require('../utils/apiResponse');

async function getSeasons(req, res) {
  try {
    return apiResponse.success(res, await historyService.getSeasons());
  } catch (err) {
    return apiResponse.error(res, err.message, err.status || 500);
  }
}

async function getRaces(req, res) {
  try {
    return apiResponse.success(res, await historyService.getRaces(req.query.season));
  } catch (err) {
    return apiResponse.error(res, err.message, err.status || 500);
  }
}

async function getRace(req, res) {
  try {
    return apiResponse.success(res, await historyService.getRace(req.params.id));
  } catch (err) {
    return apiResponse.error(res, err.message, err.status || 500);
  }
}

module.exports = { getSeasons, getRaces, getRace };
