const { buildCrudRouter } = require('./crudFactory');
const { Team } = require('../models');
const { authenticate } = require('../middleware/auth');

module.exports = buildCrudRouter({
  model: Team,
  resource: 'team',
  auth: [authenticate],
});
