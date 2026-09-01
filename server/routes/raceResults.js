const { buildCrudRouter } = require('./crudFactory');
const { RaceResult } = require('../models');

module.exports = buildCrudRouter({
  model: RaceResult,
  resource: 'race result',
  includes: ['race', 'driver'],
});
