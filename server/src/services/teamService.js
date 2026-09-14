const { buildCrudService } = require('./crudService');
const teamRepository = require('../repositories/teamRepository');

module.exports = buildCrudService({
  repository: teamRepository,
  resource: 'team',
});
