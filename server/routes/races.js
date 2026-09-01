const { buildCrudRouter } = require('./crudFactory');
const { Race } = require('../models');

module.exports = buildCrudRouter({ model: Race, resource: 'race' });
