const { buildCrudService, parseId } = require('./crudService');
const raceRepository = require('../repositories/raceRepository');
const predictionService = require('./predictionService');
const realtime = require('../realtime/io');
const { sanitizeRace } = require('../utils/serializers');

const baseService = buildCrudService({
  repository: raceRepository,
  resource: 'race',
});

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
    throw httpError(400, 'Некорректный сезон: укажите год от 1950 до 2100');
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
    throw httpError(400, 'Ссылка на трансляцию должна начинаться с http:// или https://');
  }
  if (trimmed.length > 500) {
    throw httpError(400, 'Ссылка на трансляцию слишком длинная (максимум 500 символов)');
  }
  return trimmed;
}

/**
 * Эпик-13 (BUG-04): формы админки присылают пустые строки для необязательных
 * полей. Postgres на `date = ''`/`DECIMAL = ''` падал с 400 и английским текстом,
 * поэтому пустое превращаем в NULL, а координаты приводим к числу.
 */
function normalizeOptionalDate(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed || null;
}

function normalizeCoordinate(value, label) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const number = Number(trimmed);
  if (!Number.isFinite(number)) {
    throw httpError(400, `${label} трассы должна быть числом`);
  }
  return number;
}

function normalizeRacePayload(data = {}) {
  const payload = { ...data };
  if (typeof payload.name === 'string') payload.name = payload.name.trim();
  if ('circuit' in payload) payload.circuit = String(payload.circuit ?? '').trim() || null;
  if ('country' in payload) payload.country = String(payload.country ?? '').trim() || null;
  if ('date' in payload) payload.date = normalizeOptionalDate(payload.date);
  if ('trackLatitude' in payload) payload.trackLatitude = normalizeCoordinate(payload.trackLatitude, 'Широта');
  if ('trackLongitude' in payload) payload.trackLongitude = normalizeCoordinate(payload.trackLongitude, 'Долгота');
  if ('broadcastUrl' in payload) payload.broadcastUrl = normalizeBroadcastUrl(payload.broadcastUrl);

  if ('season' in payload) {
    const season = Number(payload.season);
    if (!Number.isInteger(season) || season < 1950 || season > 2100) {
      throw httpError(400, 'Некорректный сезон: укажите год от 1950 до 2100');
    }
    payload.season = season;
  }
  if ('round' in payload) {
    const round = Number(payload.round);
    if (!Number.isInteger(round) || round < 1) {
      throw httpError(400, 'Некорректный номер этапа: нужно целое число ≥ 1');
    }
    payload.round = round;
  }

  return payload;
}

async function create(data) {
  return baseService.create(normalizeRacePayload(data));
}

/**
 * Эпик-13 (BUG-06): CRUD гонки в админке должен рассылать `race:status`,
 * иначе `/vote` в других вкладках не узнаёт о смене статуса до перезагрузки.
 * Ключ гонки — как в MongoDB: externalId, иначе числовой id.
 */
function raceKeyOf(race) {
  return String(race.externalId || race.id);
}

async function update(rawId, data) {
  const id = parseId(rawId);
  const before = id !== null ? await raceRepository.findById(id) : null;
  const updated = await baseService.update(rawId, normalizeRacePayload(data));
  if (before && updated && !updated.error) {
    realtime.emitRaceStatus({
      raceId: raceKeyOf(updated),
      name: updated.name,
      previous: before.status,
      status: updated.status,
    });
  }
  return updated;
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