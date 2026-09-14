const { buildCrudService } = require('./crudService');
const raceRepository = require('../repositories/raceRepository');

module.exports = buildCrudService({
  repository: raceRepository,
  resource: 'race',
});
