const { User } = require('../models');
const { buildCrudRepository } = require('./crudRepository');

const base = buildCrudRepository(User);

async function findByEmail(email) {
  return User.findOne({ where: { email } });
}

async function findByUsername(username) {
  return User.findOne({ where: { username } });
}

async function findByIdWithFavorites(id) {
  return User.findByPk(id, {
    include: ['favoriteDrivers', 'favoriteTeams'],
  });
}

module.exports = {
  ...base,
  findByEmail,
  findByUsername,
  findByIdWithFavorites,
};
