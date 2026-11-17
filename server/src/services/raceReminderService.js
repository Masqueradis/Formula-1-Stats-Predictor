'use strict';

const { Op } = require('sequelize');
const db = require('../models');
const raceRepository = require('../repositories/raceRepository');
const userRepository = require('../repositories/userRepository');
const emailReminderRepository = require('../repositories/emailReminderRepository');
const emailService = require('./emailService');

const REMIND_BEFORE_MS = 24 * 60 * 60 * 1000;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function sendUpcomingReminders() {
  const races = await raceRepository.findAll({
    where: { status: 'scheduled', date: { [Op.gte]: todayISO() } },
    order: [['date', 'ASC']],
  });

  const now = Date.now();
  let racesHandled = 0;
  let sent = 0;

  for (const race of races) {
    const startsAt = Date.parse(`${race.date}T00:00:00`);
    if (!Number.isFinite(startsAt) || startsAt - now > REMIND_BEFORE_MS) continue;

    const key = String(race.externalId || race.id);
    const alreadySent = await emailReminderRepository.findSentUserIds(key);

    const users = await userRepository.findAll({
      attributes: ['id', 'username', 'email'],
      where: { isVerified: true },
      include: [{
        model: db.Driver,
        as: 'favoriteDrivers',
        attributes: ['id', 'firstName', 'lastName', 'abbreviation'],
        through: { attributes: [] },
      }],
    });

    const targets = users.filter(
      (user) => user.favoriteDrivers.length > 0 && !alreadySent.has(user.id),
    );
    if (targets.length === 0) continue;

    const delivered = [];
    for (const user of targets) {
      const result = await emailService.sendRaceReminderEmail(
        user.email,
        user.username,
        race,
        user.favoriteDrivers,
      );
      if (result.ok) delivered.push(user.id);
    }

    await emailReminderRepository.markSent(key, delivered);
    racesHandled += 1;
    sent += delivered.length;
  }

  return { races: racesHandled, sent };
}

module.exports = { sendUpcomingReminders, REMIND_BEFORE_MS };
