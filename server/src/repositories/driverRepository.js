const { Driver } = require('../models');
const { buildCrudRepository } = require('./crudRepository');

module.exports = buildCrudRepository(Driver);
