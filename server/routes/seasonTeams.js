const { buildCrudRouter } = require('./crudFactory');
const { SeasonTeam } = require('../models');
const { authenticate } = require('../middleware/auth');

module.exports = buildCrudRouter({
  model: SeasonTeam,
  resource: 'season team',
  includes: ['driver', 'team'],
  auth: [authenticate],
});
