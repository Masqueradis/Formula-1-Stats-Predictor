const { buildCrudService } = require('./crudService');
const raceResultRepository = require('../repositories/raceResultRepository');

module.exports = buildCrudService({
  repository: raceResultRepository,
  resource: 'race result',
  includes: ['race', 'driver'],
});
