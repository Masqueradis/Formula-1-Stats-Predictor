require('./config/env');

const http = require('http');
const app = require('./app');
const db = require('./models');
const { connectMongo } = require('./config/mongo');
const realtime = require('./realtime/io');
const redisClient = require('./cache/redisClient');

const PORT = process.env.PORT || 3000;

db.sequelize.sync().then(() => {
  // Socket.IO прикрепляется к HTTP-серверу (лаба 7), app.listen заменён на server.listen
  const server = http.createServer(app);
  realtime.init(server);

  server.listen(PORT, () => {
    console.log(`F1 Stats server running on http://localhost:${PORT}`);
    console.log(`Socket.IO ready on ws://localhost:${PORT}/socket.io`);
  });

  // Аккуратно закрываем Redis-клиент при остановке контейнера/процесса.
  const shutdown = () => {
    redisClient
      .close()
      .catch(() => {})
      .finally(() => process.exit(0));
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  // Не блокирует старт: при недоступности Mongo сервер работает (503 на /api/predictions)
  const mongoReady = connectMongo();
  require('./jobs/f1SyncJob').start();
  // UC-2: начисление баллов по завершённым гонкам + пересчёт leaderboard (US-6).
  // Первый пересчёт уходит после connectMongo — рейтинг не пуст уже на старте.
  mongoReady.then(() => {
    require('./jobs/leaderboardJob').start();
    // Todo 7: напоминания за 24 ч до гонки (журнал дедупликации в Mongo)
    require('./jobs/emailReminderJob').start();
  });
});
