'use strict';

/**
 * E-mail напоминания за 24 часа до старта гонки (эпик-09, todo 7).
 *
 * Кому: подтверждённым пользователям, у которых есть хотя бы один избранный пилот.
 * Когда: дата гонки (DATEONLY в PostgreSQL) минус 24 ч уже наступила, гонка ещё
 * не прошла (status='scheduled'). Так как в БД хранится только дата без времени,
 * «старт» трактуется как 00:00 дня гонки — напоминание уходит в день накануне.
 * Дедупликация: журнал в MongoDB (`email_reminders`, уникальный индекс
 * raceId+userId) — повторные прогоны cron не шлют дублей.
 */

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

/**
 * Отправить напоминания о гонках, до которых осталось ≤24 часов.
 * @returns {{ races: number, sent: number }} сколько гонок обработано и писем доставлено
 */
async function sendUpcomingReminders() {
  const races = await raceRepository.findAll({
    where: { status: 'scheduled', date: { [Op.gte]: todayISO() } },
    order: [['date', 'ASC']],
  });

  const now = Date.now();
  let racesHandled = 0;
  let sent = 0;

  for (const race of races) {
    const startsAt = Date.parse(`${race.date}T00:00:00`); // DATEONLY → полночь дня гонки
    if (!Number.isFinite(startsAt) || startsAt - now > REMIND_BEFORE_MS) continue;

    const key = String(race.externalId || race.id);
    const alreadySent = await emailReminderRepository.findSentUserIds(key);

    // Пользователи с избранными пилотами (join-таблица UserFavoriteDriver)
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
      // В журнал попадают только доставленные: при падении SMTP письмо уйдёт
      // при следующем прогоне (гонки в окне 24 ч обрабатываются каждый час)
      if (result.ok) delivered.push(user.id);
    }

    await emailReminderRepository.markSent(key, delivered);
    racesHandled += 1;
    sent += delivered.length;
  }

  return { races: racesHandled, sent };
}

module.exports = { sendUpcomingReminders, REMIND_BEFORE_MS };
