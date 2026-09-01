const { buildCrudRouter } = require('./crudFactory');
const { Team } = require('../models');

module.exports = buildCrudRouter({ model: Team, resource: 'team' });
