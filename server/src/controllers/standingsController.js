const standingsService = require('../services/standingsService');
const apiResponse = require('../utils/apiResponse');

async function getStandings(req, res) {
  try {
    const result = await standingsService.getStandings(req.query.season, req.query.type);
    return apiResponse.success(res, result);
  } catch (err) {
    return apiResponse.error(res, 'Failed to load standings', 500, err.message);
  }
}

module.exports = { getStandings };