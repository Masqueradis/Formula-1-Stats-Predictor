const { buildCrudService, parseId } = require('./crudService');
const raceRepository = require('../repositories/raceRepository');
const predictionService = require('./predictionService');

const baseService = buildCrudService({
  repository: raceRepository,
  resource: 'race',
});

function sanitizeRace(race) {
  const json = typeof race.toJSON === 'function' ? race.toJSON() : race;
  const { results, ...rest } = json;
  const raceOnly = (results || []).filter(
    (r) => (r.sessionType || 'race') === 'race' && r.position != null,
  );
  const sorted = [...raceOnly].sort((a, b) => Number(a.position) - Number(b.position));
  const topThree = sorted.slice(0, 3).map((r) => {
    const driver = r.driver || {};
    const team = r.team || {};
    return {
      position: r.position,
      driver: { id: driver.id, firstName: driver.firstName, lastName: driver.lastName, abbreviation: driver.abbreviation },
      team: team.id ? { id: team.id, name: team.name, color: team.color || null } : null,
    };
  });
  return { ...rest, winner: topThree[0]?.driver || null, results: topThree };
}

function normalizeSeasonFilter(rawSeason) {
  if (rawSeason === undefined || rawSeason === null || rawSeason === '' || rawSeason === 'all') {
    return undefined;
  }
  if (rawSeason === 'current') return 'current';
  const season = Number(rawSeason);
  if (!Number.isInteger(season) || season < 1950) {
    throw httpError(400, 'season must be a valid year or "current"');
  }
  return season;
}

async function getAll({ season } = {}) {
  const filter = normalizeSeasonFilter(season);
  const races = await raceRepository.findAllWithResults({ season: filter });
  return races.map(sanitizeRace);
}

async function getById(rawId) {
  const id = parseId(rawId);
  if (id === null) return { error: 'Invalid id' };
  const race = await raceRepository.findByIdWithResults(id);
  if (!race) return { error: 'race not found', status: 404 };
  return sanitizeRace(race);
}

/**
 * Удаление гонки с каскадом в MongoDB (решение В3 эпика-06):
 * меж-БД-каскада не существует, поэтому после успешного удаления строки
 * в PostgreSQL удаляем и документ гонки в MongoDB (best-effort).
 */
async function remove(rawId) {
  const id = parseId(rawId);
  const race = id !== null ? await raceRepository.findById(id) : null;
  const result = await baseService.remove(rawId);
  if (result === true && race) {
    await predictionService.cascadeRemoveByRace(race);
  }
  return result;
}

module.exports = {
  ...baseService,
  getAll,
  getById,
  remove,
};