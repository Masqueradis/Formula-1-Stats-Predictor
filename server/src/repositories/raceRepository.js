const { Race, RaceResult } = require('../models');
const { buildCrudRepository } = require('./crudRepository');

const base = buildCrudRepository(Race);

const RESULT_INCLUDES = [
  {
    model: RaceResult,
    as: 'results',
    include: [{ association: 'driver' }, { association: 'team' }],
  },
];

async function findAllWithResults({ season } = {}) {
  const where = {};
  if (season === 'current') {
    where.season = await Race.max('season');
  } else if (Number.isInteger(season)) {
    where.season = season;
  }
  return Race.findAll({
    where,
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