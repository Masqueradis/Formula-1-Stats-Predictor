const { Driver, SeasonTeam } = require('../models');
const { Op } = require('sequelize');
const { buildCrudRepository } = require('./crudRepository');

const base = buildCrudRepository(Driver);

const DRIVER_INCLUDES = [
  { model: SeasonTeam, as: 'seasonTeams', include: [{ association: 'team' }] },
];

async function findAllWithOptions({ search, teamId, include, includeInactive } = {}) {
  const where = {};

  if (!includeInactive) {
    where.isActive = true;
  }

  if (search) {
    where[Op.or] = [
      { firstName: { [Op.iLike]: `%${search}%` } },
      { lastName: { [Op.iLike]: `%${search}%` } },
      { abbreviation: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const includes = include !== false ? DRIVER_INCLUDES : undefined;

  const order = [[{ model: SeasonTeam, as: 'seasonTeams' }, 'id', 'ASC']];

  if (teamId) {
    return Driver.findAll({
      where,
      include: [
        {
          model: SeasonTeam,
          as: 'seasonTeams',
          where: { teamId: Number(teamId) },
          include: [{ association: 'team' }],
        },
      ],
      order,
    });
  }

  return Driver.findAll({ where, include: includes, order });
}

async function findByIdWithDetails(id, { includeInactive = false } = {}) {
  const where = { id };
  if (!includeInactive) where.isActive = true;
  return Driver.findOne({
    where,
    include: DRIVER_INCLUDES,
    order: [[{ model: SeasonTeam, as: 'seasonTeams' }, 'id', 'ASC']],
  });
}

async function create(data, options = {}) {
  return base.create(data, {
    ...options,
    include: options.include || DRIVER_INCLUDES,
  });
}

module.exports = {
  ...base,
  findAllWithOptions,
  findByIdWithDetails,
  create,
};