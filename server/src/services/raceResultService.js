const { Op } = require('sequelize');
const { RaceResult, Driver, SeasonTeam } = require('../models');
const raceResultRepository = require('../repositories/raceResultRepository');
const { parseId } = require('./crudService');

const SESSION_TYPES = ['race', 'sprint'];

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function normalizeInt(value, { min, field }) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isInteger(num) || num < min) {
    throw badRequest(`${field} must be an integer >= ${min}`);
  }
  return num;
}

function normalizeNumber(value, { min, field }) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const num = Number(value);
  if (Number.isNaN(num) || num < min) {
    throw badRequest(`${field} must be a number >= ${min}`);
  }
  return num;
}

function normalizeBoolean(value, { field }) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  throw badRequest(`${field} must be a boolean`);
}

function normalizeFields(data) {
  const fields = {};
  const position = normalizeInt(data.position, { min: 1, field: 'position' });
  if (position !== undefined) fields.position = position;
  const points = normalizeNumber(data.points, { min: 0, field: 'points' });
  if (points !== undefined) fields.points = points;
  const grid = normalizeInt(data.grid, { min: 1, field: 'grid' });
  if (grid !== undefined) fields.grid = grid;
  const fastestLap = normalizeBoolean(data.fastestLap, { field: 'fastestLap' });
  if (fastestLap !== undefined) fields.fastestLap = fastestLap;
  if (data.sessionType !== undefined) {
    if (!SESSION_TYPES.includes(data.sessionType)) {
      throw badRequest(`sessionType must be one of: ${SESSION_TYPES.join(', ')}`);
    }
    fields.sessionType = data.sessionType;
  }
  return fields;
}

async function resolveTeamId(driverId) {
  const last = await SeasonTeam.findOne({
    where: { driverId },
    order: [['season', 'DESC']],
  });
  return last ? last.teamId : null;
}

async function recomputePodiums(driverId) {
  if (!driverId) return;
  const podiums = await RaceResult.count({
    where: { driverId, sessionType: 'race', position: { [Op.lte]: 3 } },
  });
  await Driver.update({ podiums }, { where: { id: driverId } });
}

async function getAll({ driverId, raceId } = {}) {
  return raceResultRepository.findAllWithOptions({ driverId, raceId });
}

async function getById(rawId) {
  const id = parseId(rawId);
  if (id === null) return { error: 'Invalid id' };
  const record = await raceResultRepository.findByIdWithDetails(id);
  if (!record) return { error: 'race result not found', status: 404 };
  return record;
}

async function create(data) {
  const raceId = parseId(data.raceId);
  if (raceId === null) return { error: 'Invalid raceId', status: 400 };
  const driverId = parseId(data.driverId);
  if (driverId === null) return { error: 'Invalid driverId', status: 400 };

  const fields = normalizeFields(data);
  const teamId = await resolveTeamId(driverId);

  const record = await RaceResult.create({ raceId, driverId, teamId, ...fields });
  await recomputePodiums(driverId);
  return raceResultRepository.findByIdWithDetails(record.id);
}

async function update(rawId, data) {
  const id = parseId(rawId);
  if (id === null) return { error: 'Invalid id' };

  const existing = await RaceResult.findByPk(id);
  if (!existing) return { error: 'race result not found', status: 404 };

  const fields = normalizeFields(data);
  if (Object.keys(fields).length) {
    await existing.update(fields);
  }
  await recomputePodiums(existing.driverId);
  return raceResultRepository.findByIdWithDetails(id);
}

async function remove(rawId) {
  const id = parseId(rawId);
  if (id === null) return { error: 'Invalid id' };

  const existing = await RaceResult.findByPk(id);
  if (!existing) return { error: 'race result not found', status: 404 };

  const driverId = existing.driverId;
  await existing.destroy();
  await recomputePodiums(driverId);
  return true;
}

module.exports = { getAll, getById, create, update, remove, recomputePodiums };
