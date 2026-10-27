const { RaceResult, Race, Driver, Team } = require('../models');
const { buildCrudRepository } = require('./crudRepository');

const base = buildCrudRepository(RaceResult);

const INCLUDES = [
  { model: Race, as: 'race' },
  { model: Driver, as: 'driver' },
  { model: Team, as: 'team' },
];

async function findAllWithOptions({ driverId, raceId, season } = {}) {
  const where = {};
  if (driverId) where.driverId = Number(driverId);
  if (raceId) where.raceId = Number(raceId);
  if (season) where['$race.season$'] = Number(season);

  // Для фильтра по сезону include гонки должен быть INNER JOIN.
  const includes = season
    ? INCLUDES.map((include) => (include.as === 'race' ? { ...include, required: true } : include))
    : INCLUDES;

  return RaceResult.findAll({
    where,
    include: includes,
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
