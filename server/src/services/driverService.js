const { SeasonTeam, Team } = require('../models');
const driverRepository = require('../repositories/driverRepository');
const { parseId } = require('./crudService');

const CURRENT_SEASON_DEFAULT = 2025;

function sanitizeDriver(record) {
  const json = typeof record.toJSON === 'function' ? record.toJSON() : record;
  const { seasonTeams, ...rest } = json;

  let team = null;
  if (Array.isArray(seasonTeams) && seasonTeams.length) {
    team = seasonTeams[0].team || null;
  } else if (seasonTeams && seasonTeams.team) {
    team = seasonTeams.team;
  }

  if (team) {
    team = { id: team.id, name: team.name, color: team.color };
  }

  return { ...rest, team };
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

async function getAll({ search, teamId } = {}) {
  const records = await driverRepository.findAllWithOptions({ search, teamId });
  return clean(records);
}

async function getById(rawId) {
  const id = parseId(rawId);
  if (id === null) return { error: 'Invalid id' };
  const record = await driverRepository.findByIdWithDetails(id);
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

  const full = await driverRepository.findByIdWithDetails(record.id);
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
  });
  if (!updated) return { error: 'driver not found', status: 404 };

  await syncDriverTeam(id, data.teamId);

  const full = await driverRepository.findByIdWithDetails(id);
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
    const deleted = await driverRepository.remove(id);
    if (!deleted) return { error: 'driver not found', status: 404 };
    return true;
  },
};