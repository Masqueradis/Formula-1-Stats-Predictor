const { buildCrudRouter } = require('./crudFactory');
const { SeasonTeam } = require('../models');

module.exports = buildCrudRouter({
  model: SeasonTeam,
  resource: 'season team',
  includes: ['driver', 'team'],
});
