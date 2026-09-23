const { buildCrudService, parseId } = require('./crudService');
const teamRepository = require('../repositories/teamRepository');

const baseService = buildCrudService({
  repository: teamRepository,
  resource: 'team',
});

function sanitizeTeam(team) {
  const json = typeof team.toJSON === 'function' ? team.toJSON() : team;
  const { seasonTeams, ...rest } = json;
  const drivers = (seasonTeams || [])
    .slice()
    .sort((a, b) => (a.id || 0) - (b.id || 0))
    .map((st) => st.driver)
    .filter(Boolean)
    .map((d) => ({
      id: d.id,
      firstName: d.firstName,
      lastName: d.lastName,
      abbreviation: d.abbreviation,
      number: d.number,
      nationality: d.nationality,
    }));
  return { ...rest, drivers };
}

async function currentSeason() {
  return teamRepository.currentSeason();
}

async function getAll() {
  const season = await currentSeason();
  const teams = await teamRepository.findAllWithDetails(season);
  return teams.map(sanitizeTeam);
}

async function getById(rawId) {
  const id = parseId(rawId);
  if (id === null) return { error: 'Invalid id' };
  const season = await currentSeason();
  const team = await teamRepository.findByIdWithDetails(id, season);
  if (!team) return { error: 'team not found', status: 404 };
  return sanitizeTeam(team);
}

module.exports = {
  ...baseService,
  getAll,
  getById,
  currentSeason,
};