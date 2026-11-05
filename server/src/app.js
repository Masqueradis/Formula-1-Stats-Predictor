const express = require('express');
const corsMiddleware = require('./middleware/cors');
const requestLogger = require('./middleware/requestLogger');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { status: mongoStatus } = require('./config/mongo');
const cacheService = require('./cache/cacheService');

const app = express();

// Backend стоит за nginx: доверяем первому прокси, чтобы rate limit и логи
// видели реальный IP клиента из X-Forwarded-For, а не IP контейнера nginx.
app.set('trust proxy', 1);
app.set('etag', false);

app.use(corsMiddleware);
app.use(express.json());

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Phase 6b (эпик-09): лог API-вызовов в stdout → Promtail → Loki
app.use(requestLogger);

app.get('/api/health', async (req, res) => {
  // Redis — деградируемая зависимость: приложение отвечает и без него.
  const redis = cacheService.isEnabled()
    ? ((await cacheService.ping()) ? 'up' : 'down')
    : 'disabled';

  res.json({
    success: true,
    data: {
      status: 'ok',
      uptime: process.uptime(),
      databases: { postgres: 'up', mongo: mongoStatus(), redis },
    },
  });
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
