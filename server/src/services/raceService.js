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
  // Эпик-10: в исторических гонках пилоты уже неактивны — не выкидываем их из подиума
  const raceOnly = (results || []).filter((r) => (r.sessionType || 'race') === 'race');
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

async function getAll({ season } = {}) {
  const resolved = await resolveSeason(season);
  const races = await raceRepository.findAllWithResults(resolved);
  return races.map(sanitizeRace);
}

/**
 * Эпик-10: `?season=current` — максимальный сезон в БД, `?season=YYYY` — конкретный.
 * Без параметра возвращается всё (для обратной совместимости), но UI так не делает.
 */
function normalizeSeasonFilter(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  if (String(raw).toLowerCase() === 'current') return 'current';
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1950 || value > 2100) {
    throw httpError(400, 'season must be a valid year');
  }
  return value;
}

async function resolveSeason(raw) {
  const filter = normalizeSeasonFilter(raw);
  if (filter === 'current') return (await raceRepository.maxSeason()) || null;
  return filter;
}

async function getById(rawId) {
  const id = parseId(rawId);
  if (id === null) return { error: 'Invalid id' };
  const race = await raceRepository.findByIdWithResults(id);
  if (!race) return { error: 'race not found', status: 404 };
  return sanitizeRace(race);
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * US-7 (эпик-09): нормализация ссылки на трансляцию.
 * Пустое значение → null (ссылки нет), иначе — валидный http(s)-URL ≤500 символов.
 */
function normalizeBroadcastUrl(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  if (!/^https?:\/\/[^\s]+$/i.test(trimmed)) {
    throw httpError(400, 'broadcastUrl must be a valid http(s) URL');
  }
  if (trimmed.length > 500) {
    throw httpError(400, 'broadcastUrl is too long (max 500 characters)');
  }
  return trimmed;
}

async function create(data) {
  return baseService.create({ ...data, broadcastUrl: normalizeBroadcastUrl(data.broadcastUrl) });
}

async function update(rawId, data) {
  const patch = { ...data };
  if (Object.prototype.hasOwnProperty.call(patch, 'broadcastUrl')) {
    patch.broadcastUrl = normalizeBroadcastUrl(patch.broadcastUrl);
  }
  return baseService.update(rawId, patch);
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
  create,
  update,
  remove,
};