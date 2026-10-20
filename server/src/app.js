const express = require('express');
const corsMiddleware = require('./middleware/cors');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.set('etag', false);

app.use(corsMiddleware);
app.use(express.json());

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', uptime: process.uptime() } });
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
