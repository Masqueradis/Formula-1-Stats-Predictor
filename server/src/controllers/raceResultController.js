const raceResultService = require('../services/raceResultService');
const apiResponse = require('../utils/apiResponse');

function handleError(res, err) {
  if (err.name === 'SequelizeUniqueConstraintError') {
    return apiResponse.error(
      res,
      'Результат для этого пилота, гонки и типа сессии уже существует',
      409,
      err.errors?.map((e) => e.message),
    );
  }
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return apiResponse.error(res, 'Ссылка на несуществующую гонку, пилота или команду', 409);
  }
  return apiResponse.error(res, err.message, err.status || 400, err.errors?.map((e) => e.message));
}

async function getAll(req, res) {
  try {
    const { driverId, raceId, season } = req.query;
    const data = await raceResultService.getAll({ driverId, raceId, season });
    return apiResponse.success(res, data);
  } catch (err) {
    return apiResponse.error(res, err.message, err.status || 500);
  }
}

async function getById(req, res) {
  try {
    const result = await raceResultService.getById(req.params.id);
    if (result.error) return apiResponse.error(res, result.error, result.status || 400);
    return apiResponse.success(res, result);
  } catch (err) {
    return apiResponse.error(res, err.message, 500);
  }
}

async function create(req, res) {
  try {
    const result = await raceResultService.create(req.body);
    if (result && result.error) return apiResponse.error(res, result.error, result.status || 400);
    return apiResponse.created(res, result);
  } catch (err) {
    return handleError(res, err);
  }
}

async function update(req, res) {
  try {
    const result = await raceResultService.update(req.params.id, req.body);
    if (result && result.error) return apiResponse.error(res, result.error, result.status || 400);
    return apiResponse.success(res, result);
  } catch (err) {
    return handleError(res, err);
  }
}

async function remove(req, res) {
  try {
    const result = await raceResultService.remove(req.params.id);
    if (result && result.error) return apiResponse.error(res, result.error, result.status || 400);
    return res.status(204).end();
  } catch (err) {
    return apiResponse.error(res, err.message, err.status || 500);
  }
}

module.exports = { getAll, getById, create, update, remove };
