require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const app = require('./app');
const db = require('./models');

const PORT = process.env.PORT || 3000;

db.sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`F1 Stats server running on http://localhost:${PORT}`);
  });
});
