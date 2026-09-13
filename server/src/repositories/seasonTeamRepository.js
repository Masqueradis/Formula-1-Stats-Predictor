const { SeasonTeam } = require('../models');
const { buildCrudRepository } = require('./crudRepository');

module.exports = buildCrudRepository(SeasonTeam);
