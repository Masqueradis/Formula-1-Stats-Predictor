const { buildCrudService } = require('./crudService');
const driverRepository = require('../repositories/driverRepository');

module.exports = buildCrudService({
  repository: driverRepository,
  resource: 'driver',
});
