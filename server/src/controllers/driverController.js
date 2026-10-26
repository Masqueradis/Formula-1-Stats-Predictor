const driverService = require('../services/driverService');
const wikiService = require('../services/wikiService');
const careerService = require('../services/careerService');
const apiResponse = require('../utils/apiResponse');

async function getAll(req, res) {
  try {
    const { search, teamId } = req.query;
    const data = await driverService.getAll({ search, teamId });
    return apiResponse.success(res, data);
  } catch (err) {
    return apiResponse.error(res, err.message, 500);
  }
}

async function getById(req, res) {
  try {
    const result = await driverService.getById(req.params.id);
    if (result.error) return apiResponse.error(res, result.error, result.status || 400);
    return apiResponse.success(res, result);
  } catch (err) {
    return apiResponse.error(res, err.message, 500);
  }
}

async function create(req, res) {
  try {
    const data = await driverService.create(req.body);
    return apiResponse.created(res, data);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return apiResponse.error(res, 'Abbreviation already in use', 409, err.errors?.map((e) => e.message));
    }
    return apiResponse.error(res, err.message, err.status || 400, err.errors?.map((e) => e.message));
  }
}

async function update(req, res) {
  try {
    const result = await driverService.update(req.params.id, req.body);
    if (result.error) return apiResponse.error(res, result.error, result.status || 400);
    return apiResponse.success(res, result);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return apiResponse.error(res, 'Abbreviation already in use', 409, err.errors?.map((e) => e.message));
    }
    return apiResponse.error(res, err.message, err.status || 400, err.errors?.map((e) => e.message));
  }
}

async function remove(req, res) {
  try {
    const result = await driverService.remove(req.params.id);
    if (result.error) return apiResponse.error(res, result.error, result.status || 400);
    return res.status(204).end();
  } catch (err) {
    return apiResponse.error(res, err.message, 500);
  }
}

/** Биография и фото из Wikipedia (ru → en фолбэк) — эпик-09, P2 */
async function getWiki(req, res) {
  try {
    const result = await wikiService.getDriverWiki(req.params.id);
    if (result.error) return apiResponse.error(res, result.error, result.status || 400);
    return apiResponse.success(res, result);
  } catch (err) {
    return apiResponse.error(res, err.message, err.status || 500);
  }
}

/** Карьера пилота: Jolpica/Ergast + локальный fallback — эпик-09, P4 */
async function getCareer(req, res) {
  try {
    const result = await careerService.getCareer(req.params.id);
    if (result.error) return apiResponse.error(res, result.error, result.status || 400);
    return apiResponse.success(res, result);
  } catch (err) {
    return apiResponse.error(res, err.message, err.status || 500);
  }
}

module.exports = { getAll, getById, create, update, remove, getWiki, getCareer };