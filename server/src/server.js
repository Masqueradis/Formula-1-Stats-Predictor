require('./config/env');

const http = require('http');
const app = require('./app');
const db = require('./models');
const { connectMongo } = require('./config/mongo');
const realtime = require('./realtime/io');
const redisClient = require('./cache/redisClient');

const PORT = process.env.PORT || 3000;

db.sequelize.sync().then(() => {
  const server = http.createServer(app);
  realtime.init(server);

  server.listen(PORT, () => {
    console.log(`F1 Stats server running on http://localhost:${PORT}`);
    console.log(`Socket.IO ready on ws://localhost:${PORT}/socket.io`);
  });

  const shutdown = () => {
    redisClient
      .close()
      .catch(() => {})
      .finally(() => process.exit(0));
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  const mongoReady = connectMongo();
  require('./jobs/f1SyncJob').start();
  mongoReady.then(() => {
    require('./jobs/leaderboardJob').start();
    require('./jobs/emailReminderJob').start();
  });
});
