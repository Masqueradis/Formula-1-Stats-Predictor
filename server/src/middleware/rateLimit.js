'use strict';

const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redisClient = require('../cache/redisClient');

/**
 * Ограничитель запросов для чувствительных эндпоинтов.
 * В тестах (NODE_ENV=test) лимит отключён, чтобы интеграционные тесты
 * не упирались в лимит и не зависели от порядка запуска.
 *
 * Если Redis включён, счётчики живут в общем хранилище и переживают
 * рестарт backend. При недоступности Redis `passOnStoreError` пропускает
 * запросы — лимиты временно не действуют, но приложение не падает.
 */
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

// Аутентификация: защита от перебора паролей.
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  prefix: 'auth',
  message: 'Too many authentication attempts, please try again later',
});

// Прогнозы/комментарии: защита от спама.
const predictionWriteLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 30,
  prefix: 'predict',
  message: 'Too many prediction requests, please slow down',
});

// Админский синк: тяжёлая операция, запуск вручную.
const adminSyncLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 5,
  prefix: 'admin-sync',
  message: 'Sync is rate limited, please wait before retrying',
});

module.exports = { createLimiter, authLimiter, predictionWriteLimiter, adminSyncLimiter };
