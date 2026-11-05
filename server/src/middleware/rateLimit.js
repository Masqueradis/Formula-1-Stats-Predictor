'use strict';

const rateLimit = require('express-rate-limit');

/**
 * Ограничитель запросов для чувствительных эндпоинтов.
 * В тестах (NODE_ENV=test) лимит отключён, чтобы интеграционные тесты
 * не упирались в лимит и не зависели от порядка запуска.
 */
function createLimiter({ windowMs = 60 * 1000, max = 60, message } = {}) {
  if (process.env.NODE_ENV === 'test') {
    return (req, res, next) => next();
  }
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
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
  message: 'Too many authentication attempts, please try again later',
});

// Прогнозы/комментарии: защита от спама.
const predictionWriteLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many prediction requests, please slow down',
});

// Админский синк: тяжёлая операция, запуск вручную.
const adminSyncLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Sync is rate limited, please wait before retrying',
});

module.exports = { createLimiter, authLimiter, predictionWriteLimiter, adminSyncLimiter };
