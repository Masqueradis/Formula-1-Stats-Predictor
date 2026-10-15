const { RaceResult, Race, Driver, Team } = require('../models');
const { buildCrudRepository } = require('./crudRepository');

const base = buildCrudRepository(RaceResult);

const INCLUDES = [
  { model: Race, as: 'race' },
  { model: Driver, as: 'driver' },
  { model: Team, as: 'team' },
];

async function findAllWithOptions({ driverId, raceId } = {}) {
  const where = {};
  if (driverId) where.driverId = Number(driverId);
  if (raceId) where.raceId = Number(raceId);

  return RaceResult.findAll({
    where,
    include: INCLUDES,
    order: [['position', 'ASC'], ['id', 'ASC']],
  });
}

async function findByIdWithDetails(id) {
  return RaceResult.findByPk(id, { include: INCLUDES });
}

module.exports = {
  ...base,
  findAllWithOptions,
  findByIdWithDetails,
};
