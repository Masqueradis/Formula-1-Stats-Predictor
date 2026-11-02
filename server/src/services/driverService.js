const { SeasonTeam, Team, Driver, RaceResult, sequelize } = require('../models');
const driverRepository = require('../repositories/driverRepository');
const { parseId } = require('./crudService');

const CURRENT_SEASON_DEFAULT = 2026;

function sanitizeDriver(record) {
  const json = typeof record.toJSON === 'function' ? record.toJSON() : record;
  const { seasonTeams, ...rest } = json;

  let team = null;
  let teamSeason = null;
  if (Array.isArray(seasonTeams) && seasonTeams.length) {
    const last = seasonTeams[seasonTeams.length - 1];
    team = last.team || null;
    teamSeason = last.season ?? null;
  } else if (seasonTeams && seasonTeams.team) {
    team = seasonTeams.team;
    teamSeason = seasonTeams.season ?? null;
  }

  if (team) {
    team = { id: team.id, name: team.name, color: team.color };
  }

  return { ...rest, team, teamSeason };
}

function clean(record) {
  if (Array.isArray(record)) return record.map(sanitizeDriver);
  return sanitizeDriver(record);
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
    const err = new Error('Team not found');
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
  const records = await driverRepository.findAllWithOptions({ search, teamId, includeInactive });
  return clean(records);
}

async function getById(rawId) {
  const id = parseId(rawId);
  if (id === null) return { error: 'Invalid id' };
  // includeInactive: архивные пилоты открываются из исторических Гран-при
  const record = await driverRepository.findByIdWithDetails(id, { includeInactive: true });
  if (!record) return { error: 'driver not found', status: 404 };
  return sanitizeDriver(record);
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

  const full = await driverRepository.findByIdWithDetails(record.id, { includeInactive: true });
  return sanitizeDriver(full);
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
  if (!updated) return { error: 'driver not found', status: 404 };

  await syncDriverTeam(id, data.teamId);

  const full = await driverRepository.findByIdWithDetails(id, { includeInactive: true });
  return sanitizeDriver(full);
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove: async (rawId) => {
    const id = parseId(rawId);
    if (id === null) return { error: 'Invalid id' };

    const driver = await Driver.findByPk(id);
    if (!driver) return { error: 'driver not found', status: 404 };

    const results = await RaceResult.count({ where: { driverId: id } });
    if (results > 0) {
      return {
        error:
          'Невозможно удалить пилота: у него есть результаты гран-при. ' +
          'Сначала удалите результаты во вкладке «Результаты» или архивируйте пилота.',
        status: 409,
      };
    }

    await sequelize.transaction(async (t) => {
      await SeasonTeam.destroy({ where: { driverId: id }, transaction: t });
      await Driver.destroy({ where: { id }, transaction: t });
    });

    return true;
  },
};