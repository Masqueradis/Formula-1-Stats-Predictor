const express = require('express');
const { buildCrudRouter } = require('./crudFactory');
const { User, Driver, Team } = require('../models');
const { authenticate, isAdmin } = require('../middleware/auth');

const router = express.Router();

function sanitizeUser(u) {
  const json = typeof u.toJSON === 'function' ? u.toJSON() : u;
  const { passwordHash, ...rest } = json;
  return rest;
}

router.use(buildCrudRouter({
  model: User,
  resource: 'user',
  includes: ['favoriteDrivers', 'favoriteTeams'],
  auth: [authenticate, isAdmin],
  sanitize: sanitizeUser,
}));

function ensureOwnProfile(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id !== Number(req.user.id)) {
    res.status(403).json({ error: 'You can only manage your own favorites' });
    return false;
  }
  return id;
}

router.post('/:id/favorite-drivers', authenticate, async (req, res) => {
  const userId = ensureOwnProfile(req, res);
  if (userId === false) return;

  const { driverId } = req.body;
  if (!Number.isInteger(Number(driverId))) {
    return res.status(400).json({ error: 'driverId is required' });
  }

  const driver = await Driver.findByPk(driverId);
  if (!driver) {
    return res.status(404).json({ error: 'Driver not found' });
  }

  const user = await User.findByPk(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (await user.hasFavoriteDriver(driver.id)) {
    return res.status(409).json({ error: 'Driver already in favorites' });
  }

  await user.addFavoriteDriver(driver.id);
  return res.status(201).json({ message: 'Driver added to favorites' });
});

router.delete('/:id/favorite-drivers/:driverId', authenticate, async (req, res) => {
  const userId = ensureOwnProfile(req, res);
  if (userId === false) return;

  const driverId = Number(req.params.driverId);
  if (!Number.isInteger(driverId)) {
    return res.status(400).json({ error: 'Invalid driverId' });
  }

  const user = await User.findByPk(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  await user.removeFavoriteDriver(driverId);
  return res.status(204).end();
});

router.post('/:id/favorite-teams', authenticate, async (req, res) => {
  const userId = ensureOwnProfile(req, res);
  if (userId === false) return;

  const { teamId } = req.body;
  if (!Number.isInteger(Number(teamId))) {
    return res.status(400).json({ error: 'teamId is required' });
  }

  const team = await Team.findByPk(teamId);
  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }

  const user = await User.findByPk(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (await user.hasFavoriteTeam(team.id)) {
    return res.status(409).json({ error: 'Team already in favorites' });
  }

  await user.addFavoriteTeam(team.id);
  return res.status(201).json({ message: 'Team added to favorites' });
});

router.delete('/:id/favorite-teams/:teamId', authenticate, async (req, res) => {
  const userId = ensureOwnProfile(req, res);
  if (userId === false) return;

  const teamId = Number(req.params.teamId);
  if (!Number.isInteger(teamId)) {
    return res.status(400).json({ error: 'Invalid teamId' });
  }

  const user = await User.findByPk(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  await user.removeFavoriteTeam(teamId);
  return res.status(204).end();
});

module.exports = router;