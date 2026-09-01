const { buildCrudRouter } = require('./crudFactory');
const { User } = require('../models');

module.exports = buildCrudRouter({
  model: User,
  resource: 'user',
  includes: ['favoriteDrivers', 'favoriteTeams'],
});
