const { Driver, SeasonTeam } = require('../models');
const { Op } = require('sequelize');
const { buildCrudRepository } = require('./crudRepository');

const base = buildCrudRepository(Driver);

const DRIVER_INCLUDES = [
  { model: SeasonTeam, as: 'seasonTeams', include: [{ association: 'team' }] },
];

async function findAllWithOptions({ search, teamId, include }) {
  const where = {};

  if (search) {
    where[Op.or] = [
      { firstName: { [Op.iLike]: `%${search}%` } },
      { lastName: { [Op.iLike]: `%${search}%` } },
      { abbreviation: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const includes = include !== false ? DRIVER_INCLUDES : undefined;

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
    });
  }

  return Driver.findAll({ where, include: includes });
}

async function findByIdWithDetails(id) {
  return Driver.findByPk(id, { include: DRIVER_INCLUDES });
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