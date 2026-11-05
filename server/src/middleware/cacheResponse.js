'use strict';

const cacheService = require('../cache/cacheService');
const cacheKeys = require('../cache/keys');
const logger = require('../utils/logger');

/**
 * Прозрачный серверный кэш публичных GET-ответов (эпик-11).
 *
 * - Кэшируются только GET и только ответы со статусом 200.
 * - Ключ — `f1:api:<originalUrl>`; query-параметры входят в ключ.
 * - Заголовок `X-Cache: HIT|MISS` показывает, отдан ли ответ из кэша.
 * - Браузерный `Cache-Control: no-store` остаётся: кэш серверный.
 */
function cacheResponse(ttlMs = 60 * 1000) {
  return async function cacheResponseMiddleware(req, res, next) {
    if (req.method !== 'GET' || process.env.NODE_ENV === 'test') {
      return next();
    }

    const key = cacheKeys.api(req.originalUrl);

    try {
      const cached = await cacheService.get(key);
      if (cached !== null && cached !== undefined) {
        res.set('X-Cache', 'HIT');
        return res.json(cached);
      }
    } catch (err) {
      logger.warn('cache.read_failed', { key, reason: err.message });
    }

    res.set('X-Cache', 'MISS');
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200) {
        cacheService
          .set(key, body, ttlMs)
          .catch((err) => logger.warn('cache.write_failed', { key, reason: err.message }));
      }
      return originalJson(body);
    };

    return next();
  };
}

module.exports = cacheResponse;
