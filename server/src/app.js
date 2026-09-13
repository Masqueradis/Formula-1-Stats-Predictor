const express = require('express');
const corsMiddleware = require('./middleware/cors');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(corsMiddleware);
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', uptime: process.uptime() } });
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
