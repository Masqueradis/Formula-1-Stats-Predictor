const { Team, SeasonTeam } = require('../models');
const { buildCrudRepository } = require('./crudRepository');

const base = buildCrudRepository(Team);

function buildTeamIncludes(season) {
  return [
    {
      model: SeasonTeam,
      as: 'seasonTeams',
      where: { season },
      required: false,
      include: [{ association: 'driver' }],
    },
  ];
}

async function currentSeason() {
  const max = await SeasonTeam.max('season');
  return max || 2026;
}

async function findAllWithDetails(season, { includeInactive } = {}) {
  const where = includeInactive ? {} : { isActive: true };
  return Team.findAll({ where, include: buildTeamIncludes(season) });
}

async function findByIdWithDetails(id, season, { includeInactive = false } = {}) {
  const where = { id };
  if (!includeInactive) where.isActive = true;
  return Team.findOne({ where, include: buildTeamIncludes(season) });
}

module.exports = {
  ...base,
  currentSeason,
  findAllWithDetails,
  findByIdWithDetails,
};