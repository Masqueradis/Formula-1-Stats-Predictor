const userService = require('../services/userService');
const apiResponse = require('../utils/apiResponse');

async function getAll(req, res) {
  try {
    const data = await userService.getAll();
    return apiResponse.success(res, data);
  } catch (err) {
    return apiResponse.error(res, err.message, 500);
  }
}

async function getById(req, res) {
  try {
    const result = await userService.getById(req.params.id);
    if (result.error) return apiResponse.error(res, result.error, result.status || 400);
    return apiResponse.success(res, result);
  } catch (err) {
    return apiResponse.error(res, err.message, 500);
  }
}

async function update(req, res) {
  try {
    const result = await userService.update(req.params.id, req.body);
    if (result.error) return apiResponse.error(res, result.error, result.status || 400);
    return apiResponse.success(res, result);
  } catch (err) {
    return apiResponse.error(res, err.message, 400, err.errors?.map((e) => e.message));
  }
}

async function remove(req, res) {
  try {
    const result = await userService.remove(req.params.id);
    if (result.error) return apiResponse.error(res, result.error, result.status || 400);
    return res.status(204).end();
  } catch (err) {
    return apiResponse.error(res, err.message, 500);
  }
}

function parseFavoriteId(rawId) {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function addFavoriteDriver(req, res) {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId !== Number(req.user.id)) {
    return apiResponse.error(res, 'You can only manage your own favorites', 403);
  }

  try {
    const { driverId } = req.body;
    if (!Number.isInteger(Number(driverId))) {
      return apiResponse.error(res, 'driverId is required');
    }

    const result = await userService.addFavoriteDriver(userId, driverId);
    if (result.error) return apiResponse.error(res, result.error, result.status || 400);
    return apiResponse.created(res, result.data);
  } catch (err) {
    return apiResponse.error(res, 'Failed to add favorite driver', 500, err.message);
  }
}

async function removeFavoriteDriver(req, res) {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId !== Number(req.user.id)) {
    return apiResponse.error(res, 'You can only manage your own favorites', 403);
  }

  try {
    const driverId = parseFavoriteId(req.params.driverId);
    if (driverId === null) return apiResponse.error(res, 'Invalid driverId');

    const result = await userService.removeFavoriteDriver(userId, driverId);
    if (result.error) return apiResponse.error(res, result.error, result.status || 400);
    return res.status(204).end();
  } catch (err) {
    return apiResponse.error(res, 'Failed to remove favorite driver', 500, err.message);
  }
}

async function addFavoriteTeam(req, res) {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId !== Number(req.user.id)) {
    return apiResponse.error(res, 'You can only manage your own favorites', 403);
  }

  try {
    const { teamId } = req.body;
    if (!Number.isInteger(Number(teamId))) {
      return apiResponse.error(res, 'teamId is required');
    }

    const result = await userService.addFavoriteTeam(userId, teamId);
    if (result.error) return apiResponse.error(res, result.error, result.status || 400);
    return apiResponse.created(res, result.data);
  } catch (err) {
    return apiResponse.error(res, 'Failed to add favorite team', 500, err.message);
  }
}

async function removeFavoriteTeam(req, res) {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId !== Number(req.user.id)) {
    return apiResponse.error(res, 'You can only manage your own favorites', 403);
  }

  try {
    const teamId = parseFavoriteId(req.params.teamId);
    if (teamId === null) return apiResponse.error(res, 'Invalid teamId');

    const result = await userService.removeFavoriteTeam(userId, teamId);
    if (result.error) return apiResponse.error(res, result.error, result.status || 400);
    return res.status(204).end();
  } catch (err) {
    return apiResponse.error(res, 'Failed to remove favorite team', 500, err.message);
  }
}

module.exports = {
  getAll, getById, update, remove,
  addFavoriteDriver, removeFavoriteDriver,
  addFavoriteTeam, removeFavoriteTeam,
};
