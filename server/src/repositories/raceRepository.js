const { Race, RaceResult } = require('../models');
const { buildCrudRepository } = require('./crudRepository');

const base = buildCrudRepository(Race);

const RESULT_INCLUDES = [{ model: RaceResult, as: 'results', include: [{ association: 'driver' }] }];

async function findAllWithResults(season) {
  const where = season ? { season } : {};
  return Race.findAll({
    where,
    include: RESULT_INCLUDES,
    order: [
      ['season', 'ASC'],
      ['round', 'ASC'],
    ],
  });
}

async function maxSeason() {
  return Race.max('season');
}

async function findByIdWithResults(id) {
  return Race.findByPk(id, { include: RESULT_INCLUDES });
}

module.exports = {
  ...base,
  findAllWithResults,
  findByIdWithResults,
  maxSeason,
};
