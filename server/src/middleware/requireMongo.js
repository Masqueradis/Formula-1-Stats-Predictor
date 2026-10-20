'use strict';

const { status } = require('../config/mongo');
const apiResponse = require('../utils/apiResponse');

/**
 * 503, если MongoDB недоступна (деградированный режим).
 * Ставится на все /api/predictions* роуты.
 */
function requireMongo(req, res, next) {
  if (status() !== 'up') {
    return apiResponse.error(res, 'MongoDB is unavailable — predictions API is temporarily disabled', 503);
  }
  next();
}

module.exports = requireMongo;
