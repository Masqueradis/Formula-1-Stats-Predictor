'use strict';

const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redisClient = require('../cache/redisClient');

function buildStore(prefix) {
  if (!redisClient.isEnabled()) return undefined;

  return new RedisStore({
    sendCommand: async (...args) => {
      const client = await redisClient.getClient();
      if (!client) throw new Error('Redis is unavailable');
      return client.sendCommand(args);
    },
    prefix: `f1:rl:${prefix}:`,
  });
}

function createLimiter({ windowMs = 60 * 1000, max = 60, message, prefix = 'default' } = {}) {
  if (process.env.NODE_ENV === 'test') {
    return (req, res, next) => next();
  }
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore(prefix),
    passOnStoreError: true,
    message: {
      success: false,
      error: message || 'Too many requests, please try again later',
    },
  });
}

const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  prefix: 'auth',
  message: 'Too many authentication attempts, please try again later',
});

const predictionWriteLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 30,
  prefix: 'predict',
  message: 'Too many prediction requests, please slow down',
});

const resendVerificationLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  prefix: 'verify-resend',
  message: 'Слишком много запросов на отправку письма. Попробуйте позже',
});

const adminSyncLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 5,
  prefix: 'admin-sync',
  message: 'Sync is rate limited, please wait before retrying',
});

module.exports = {
  createLimiter,
  authLimiter,
  resendVerificationLimiter,
  predictionWriteLimiter,
  adminSyncLimiter,
};
