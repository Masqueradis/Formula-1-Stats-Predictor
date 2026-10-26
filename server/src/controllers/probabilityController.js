'use strict';

const probabilityService = require('../services/probabilityService');
const apiResponse = require('../utils/apiResponse');

async function getNext(req, res) {
  try {
    const data = await probabilityService.getNextProbabilities();
    return apiResponse.success(res, data);
  } catch (err) {
    return apiResponse.error(res, err.message, err.status || 500);
  }
}

module.exports = { getNext };
