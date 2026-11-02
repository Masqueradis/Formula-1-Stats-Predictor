const express = require('express');
const corsMiddleware = require('./middleware/cors');
const requestLogger = require('./middleware/requestLogger');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { status: mongoStatus } = require('./config/mongo');

const app = express();

app.set('etag', false);

app.use(corsMiddleware);
app.use(express.json());

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Phase 6b (эпик-09): лог API-вызовов в stdout → Promtail → Loki
app.use(requestLogger);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptime: process.uptime(),
      databases: { postgres: 'up', mongo: mongoStatus() },
    },
  });
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
