'use strict';

const { status } = require('../config/mongo');
const apiResponse = require('../utils/apiResponse');

function requireMongo(req, res, next) {
  if (status() !== 'up') {
    return apiResponse.error(res, 'MongoDB is unavailable — predictions API is temporarily disabled', 503);
  }
  next();
}

module.exports = requireMongo;
