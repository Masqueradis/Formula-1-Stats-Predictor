const { Race, RaceResult } = require('../models');
const { buildCrudRepository } = require('./crudRepository');

const base = buildCrudRepository(Race);

const RESULT_INCLUDES = [{ model: RaceResult, as: 'results', include: [{ association: 'driver' }] }];

async function findAllWithResults() {
  return Race.findAll({
    include: RESULT_INCLUDES,
    order: [
      ['season', 'ASC'],
      ['round', 'ASC'],
    ],
  });
}

async function findByIdWithResults(id) {
  return Race.findByPk(id, { include: RESULT_INCLUDES });
}

module.exports = {
  ...base,
  findAllWithResults,
  findByIdWithResults,
};