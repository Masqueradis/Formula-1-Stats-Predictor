require('./config/env');

const app = require('./app');
const db = require('./models');
const { connectMongo } = require('./config/mongo');

const PORT = process.env.PORT || 3000;

db.sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`F1 Stats server running on http://localhost:${PORT}`);
  });
  // Не блокирует старт: при недоступности Mongo сервер работает (503 на /api/predictions)
  connectMongo();
  require('./jobs/f1SyncJob').start();
});
