const { RaceResult } = require('../models');
const { buildCrudRepository } = require('./crudRepository');

module.exports = buildCrudRepository(RaceResult);
