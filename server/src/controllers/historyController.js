const historyService = require('../services/historyService');
const apiResponse = require('../utils/apiResponse');

async function getSeasons(req, res) {
  try {
    const data = await historyService.getSeasons();
    return apiResponse.success(res, data);
  } catch (err) {
    return apiResponse.error(res, err.message, err.status || 500);
  }
}

async function getRaces(req, res) {
  try {
    const data = await historyService.getRaces(req.query.season);
    return apiResponse.success(res, data);
  } catch (err) {
    return apiResponse.error(res, err.message, err.status || 500);
  }
}

async function getRace(req, res) {
  try {
    const data = await historyService.getRace(req.params.id);
    return apiResponse.success(res, data);
  } catch (err) {
    return apiResponse.error(res, err.message, err.status || 500);
  }
}

module.exports = { getSeasons, getRaces, getRace };
