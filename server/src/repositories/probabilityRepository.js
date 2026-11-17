'use strict';

const { Race, RaceResult, SeasonTeam } = require('../models');
const { Op } = require('sequelize');

async function findNextRace() {
  const today = new Date().toISOString().slice(0, 10);
  return Race.findOne({
    where: { status: 'scheduled', date: { [Op.gte]: today } },
    order: [['date', 'ASC'], ['season', 'ASC'], ['round', 'ASC']],
  });
}

async function findRoster(season) {
  return SeasonTeam.findAll({
    where: { season, isReserve: false },
    include: [
      { association: 'driver' },
      { association: 'team', attributes: ['id', 'name', 'color', 'isActive'] },
    ],
    order: [['id', 'ASC']],
  });
}

async function findSeasonResults(season) {
  return RaceResult.findAll({
    where: { '$race.season$': season },
    include: [
      { model: Race, as: 'race', attributes: ['id', 'date', 'round', 'circuit', 'season'] },
    ],
  });
}

async function findCircuitResults(circuit) {
  if (!circuit) return [];
  return RaceResult.findAll({
    include: [
      {
        model: Race,
        as: 'race',
        attributes: ['id', 'date', 'season', 'round'],
        where: { circuit },
        required: true,
      },
    ],
  });
}

module.exports = {
  findNextRace,
  findRoster,
  findSeasonResults,
  findCircuitResults,
};
