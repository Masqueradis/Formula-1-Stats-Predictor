const { buildCrudRouter } = require('./crudFactory');
const { Driver } = require('../models');
const { authenticate } = require('../middleware/auth');

module.exports = buildCrudRouter({
  model: Driver,
  resource: 'driver',
  auth: [authenticate],
});
