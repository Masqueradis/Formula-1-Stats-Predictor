const { buildCrudRouter } = require('./crudFactory');
const { Driver } = require('../models');

module.exports = buildCrudRouter({ model: Driver, resource: 'driver' });
