const { buildCrudService } = require('./crudService');
const seasonTeamRepository = require('../repositories/seasonTeamRepository');

module.exports = buildCrudService({
  repository: seasonTeamRepository,
  resource: 'season team',
  includes: ['driver', 'team'],
});
