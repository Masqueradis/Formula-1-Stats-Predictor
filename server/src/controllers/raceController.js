const raceService = require('../services/raceService');
const apiResponse = require('../utils/apiResponse');

async function getAll(req, res) {
  try {
    const data = await raceService.getAll();
    return apiResponse.success(res, data);
  } catch (err) {
    return apiResponse.error(res, err.message, 500);
  }
}

async function getById(req, res) {
  try {
    const result = await raceService.getById(req.params.id);
    if (result.error) return apiResponse.error(res, result.error, result.status || 400);
    return apiResponse.success(res, result);
  } catch (err) {
    return apiResponse.error(res, err.message, 500);
  }
}

async function create(req, res) {
  try {
    const data = await raceService.create(req.body);
    return apiResponse.created(res, data);
  } catch (err) {
    return apiResponse.error(res, err.message, 400, err.errors?.map((e) => e.message));
  }
}

async function update(req, res) {
  try {
    const result = await raceService.update(req.params.id, req.body);
    if (result.error) return apiResponse.error(res, result.error, result.status || 400);
    return apiResponse.success(res, result);
  } catch (err) {
    return apiResponse.error(res, err.message, 400, err.errors?.map((e) => e.message));
  }
}

async function remove(req, res) {
  try {
    const result = await raceService.remove(req.params.id);
    if (result.error) return apiResponse.error(res, result.error, result.status || 400);
    return res.status(204).end();
  } catch (err) {
    return apiResponse.error(res, err.message, 500);
  }
}

module.exports = { getAll, getById, create, update, remove };
