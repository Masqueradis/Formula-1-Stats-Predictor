const { Team } = require('../models');
const { buildCrudRepository } = require('./crudRepository');

module.exports = buildCrudRepository(Team);
