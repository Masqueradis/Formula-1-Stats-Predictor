const { SeasonTeam, Team } = require('../models');
const driverRepository = require('../repositories/driverRepository');
const { parseId } = require('./crudService');
const { sanitizeDriver } = require('../utils/serializers');
const { cleanSearch, cleanId } = require('../utils/queryParams');
const { invalidateApiCache } = require('../cache/invalidate');

const CURRENT_SEASON_DEFAULT = 2026;

/** Эпик-13 (BUG-07): сериализация с признаком участия в текущем сезоне. */
async function clean(record) {
  const season = await currentSeason();
  const options = { currentSeason: season };
  if (Array.isArray(record)) return record.map((item) => sanitizeDriver(item, options));
  return sanitizeDriver(record, options);
}

async function currentSeason() {
  const latest = await SeasonTeam.max('season');
  return latest || CURRENT_SEASON_DEFAULT;
}

async function syncDriverTeam(driverId, teamId) {
  const numId = Number(teamId);
  if (!numId) return;

  const team = await Team.findByPk(numId);
  if (!team) {
    const err = new Error('Команда не найдена');
    err.status = 400;
    throw err;
  }

  const season = await currentSeason();

  const existing = await SeasonTeam.findOne({
    where: { driverId, season },
  });

  if (existing) {
    if (existing.teamId !== Number(teamId)) {
      await existing.update({ teamId: Number(teamId) });
    }
  } else {
    await SeasonTeam.create({ driverId, season, teamId: Number(teamId) });
  }
}

async function getAll({ search, teamId, includeInactive } = {}) {
  const records = await driverRepository.findAllWithOptions({
    search: cleanSearch(search),
    teamId: cleanId(teamId),
    includeInactive,
  });
  return clean(records);
}

async function getById(rawId) {
  const id = parseId(rawId);
  if (id === null) return { error: 'Invalid id' };
  // includeInactive: архивные пилоты открываются из исторических Гран-при
  const record = await driverRepository.findByIdWithDetails(id, { includeInactive: true });
  if (!record) return { error: 'Пилот не найден', status: 404 };
  return clean(record);
}

async function create(data) {
  const record = await driverRepository.create({
    firstName: data.firstName,
    lastName: data.lastName,
    abbreviation: data.abbreviation,
    number: data.number,
    nationality: data.nationality,
    dateOfBirth: data.dateOfBirth || null,
    imageUrl: data.imageUrl || null,
    podiums: data.podiums || 0,
  });

  await syncDriverTeam(record.id, data.teamId);
  await invalidateApiCache();

  const full = await driverRepository.findByIdWithDetails(record.id, { includeInactive: true });
  return clean(full);
}

async function update(rawId, data) {
  const id = parseId(rawId);
  if (id === null) return { error: 'Invalid id' };

  const updated = await driverRepository.update(id, {
    firstName: data.firstName,
    lastName: data.lastName,
    abbreviation: data.abbreviation,
    number: data.number,
    nationality: data.nationality,
    dateOfBirth: data.dateOfBirth,
    imageUrl: data.imageUrl,
    podiums: data.podiums,
    isActive: data.isActive,
  });
  if (!updated) return { error: 'Пилот не найден', status: 404 };

  await syncDriverTeam(id, data.teamId);
  await invalidateApiCache();

  const full = await driverRepository.findByIdWithDetails(id, { includeInactive: true });
  return clean(full);
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove: async (rawId) => {
    const id = parseId(rawId);
    if (id === null) return { error: 'Invalid id' };

    const driver = await driverRepository.findById(id);
    if (!driver) return { error: 'Пилот не найден', status: 404 };

    const results = await driverRepository.countResults(id);
    if (results > 0) {
      return {
        error:
          'Невозможно удалить пилота: у него есть результаты гран-при. ' +
          'Сначала удалите результаты во вкладке «Результаты» или архивируйте пилота.',
        status: 409,
      };
    }

    await driverRepository.removeWithRelations(id);
    await invalidateApiCache();

    return true;
  },
};