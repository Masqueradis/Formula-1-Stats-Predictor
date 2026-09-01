const { buildCrudRouter } = require('./crudFactory');
const { RaceResult } = require('../models');
const { authenticate } = require('../middleware/auth');

module.exports = buildCrudRouter({
  model: RaceResult,
  resource: 'race result',
  includes: ['race', 'driver'],
  auth: [authenticate],
});
