const { buildCrudService } = require('./crudService');
const userRepository = require('../repositories/userRepository');
const driverRepository = require('../repositories/driverRepository');
const teamRepository = require('../repositories/teamRepository');

function sanitizeUser(u) {
  const json = typeof u.toJSON === 'function' ? u.toJSON() : u;
  const { passwordHash, ...rest } = json;
  return rest;
}

const baseService = buildCrudService({
  repository: userRepository,
  resource: 'user',
  includes: ['favoriteDrivers', 'favoriteTeams'],
  sanitize: sanitizeUser,
});

async function addFavoriteDriver(userId, driverId) {
  const driver = await driverRepository.findById(driverId);
  if (!driver) return { error: 'Driver not found', status: 404 };

  const user = await userRepository.findById(userId);
  if (!user) return { error: 'User not found', status: 404 };

  if (await user.hasFavoriteDriver(driver.id)) {
    return { error: 'Driver already in favorites', status: 409 };
  }

  await user.addFavoriteDriver(driver.id);
  return { data: { message: 'Driver added to favorites' }, status: 201 };
}

async function removeFavoriteDriver(userId, driverId) {
  const user = await userRepository.findById(userId);
  if (!user) return { error: 'User not found', status: 404 };

  await user.removeFavoriteDriver(driverId);
  return true;
}

async function addFavoriteTeam(userId, teamId) {
  const team = await teamRepository.findById(teamId);
  if (!team) return { error: 'Team not found', status: 404 };

  const user = await userRepository.findById(userId);
  if (!user) return { error: 'User not found', status: 404 };

  if (await user.hasFavoriteTeam(team.id)) {
    return { error: 'Team already in favorites', status: 409 };
  }

  await user.addFavoriteTeam(team.id);
  return { data: { message: 'Team added to favorites' }, status: 201 };
}

async function removeFavoriteTeam(userId, teamId) {
  const user = await userRepository.findById(userId);
  if (!user) return { error: 'User not found', status: 404 };

  await user.removeFavoriteTeam(teamId);
  return true;
}

module.exports = {
  ...baseService,
  addFavoriteDriver,
  removeFavoriteDriver,
  addFavoriteTeam,
  removeFavoriteTeam,
};
