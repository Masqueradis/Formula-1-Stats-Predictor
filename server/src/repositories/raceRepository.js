const { Race } = require('../models');
const { buildCrudRepository } = require('./crudRepository');

module.exports = buildCrudRepository(Race);
