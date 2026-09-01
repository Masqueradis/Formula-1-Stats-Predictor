const express = require('express');

const driversRouter = require('./routes/drivers');
const teamsRouter = require('./routes/teams');
const racesRouter = require('./routes/races');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use('/api/drivers', driversRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/races', racesRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`F1 Stats server running on http://localhost:${PORT}`);
});