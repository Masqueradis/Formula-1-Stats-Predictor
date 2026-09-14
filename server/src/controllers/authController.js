const authService = require('../services/authService');
const apiResponse = require('../utils/apiResponse');

async function register(req, res) {
  try {
    const result = await authService.register(req.body);
    if (result.error) return apiResponse.error(res, result.error, result.status || 400);
    return apiResponse.created(res, result.data);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return apiResponse.error(res, 'Username or email already in use', 409);
    }
    return apiResponse.error(res, 'Invalid data', 400, err.message);
  }
}

async function login(req, res) {
  try {
    const result = await authService.login(req.body);
    if (result.error) return apiResponse.error(res, result.error, result.status || 400);
    return apiResponse.success(res, result.data);
  } catch (err) {
    return apiResponse.error(res, 'Login failed', 500, err.message);
  }
}

async function me(req, res) {
  try {
    const result = await authService.getMe(req.user.id);
    if (result.error) return apiResponse.error(res, result.error, result.status || 400);
    return apiResponse.success(res, result);
  } catch (err) {
    return apiResponse.error(res, 'Failed to fetch user', 500, err.message);
  }
}

module.exports = { register, login, me };
