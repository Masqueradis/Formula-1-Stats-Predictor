'use strict';

const { logEvent } = require('../utils/logger');

/**
 * Логирование API-вызовов (эпик-09, Phase 6b): одна JSON-строка на запрос
 * с методом, путём, статусом и длительностью. 5xx → level=error,
 * 4xx → warn, остальное → info. Health-check не логируем (слишком часто).
 */
function requestLogger(req, res, next) {
  if (req.path === '/api/health') return next();

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const status = res.statusCode;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    logEvent(level, 'http.request', {
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status,
      ms: Math.round(ms * 10) / 10,
      userId: req.user?.id ?? null,
    });
  });

  next();
}

module.exports = requestLogger;
