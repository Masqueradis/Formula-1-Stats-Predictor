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
    (r) => (r.sessionType || 'race') === 'race' && !(r.driver && r.driver.isActive === false),
  );
  const sorted = [...raceOnly].sort((a, b) => (a.position || 0) - (b.position || 0));
  const winner = sorted.find((r) => r.position === 1) || null;
  const topThree = sorted.slice(0, 3).map((r) => {
    const driver = r.driver || {};
    return {
      position: r.position,
      driver: { id: driver.id, firstName: driver.firstName, lastName: driver.lastName, abbreviation: driver.abbreviation },
    };
  });
  return { ...rest, winner: winner && winner.driver ? topThree[0].driver : null, results: topThree };
}

async function getAll() {
  const races = await raceRepository.findAllWithResults();
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