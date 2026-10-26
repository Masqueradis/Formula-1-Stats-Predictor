'use strict';

const EmailReminder = require('../models/mongo/emailReminder');

/**
 * Репозиторий журнала email-напоминаний (MongoDB, эпик-09 todo 7).
 * Нужен только для идемпотентности cron: кто уже получил письмо о гонке.
 */

/** userId, которым уже отправлено напоминание о данной гонке */
async function findSentUserIds(raceId) {
  const rows = await EmailReminder.find({ raceId }).select('userId').lean().exec();
  return new Set(rows.map((row) => row.userId));
}

/** Записать факт отправки (ordered:false — лишние дубли не роняют батч) */
async function markSent(raceId, userIds) {
  if (!userIds.length) return null;
  const now = new Date();
  try {
    return await EmailReminder.insertMany(
      userIds.map((userId) => ({ raceId, userId, sentAt: now })),
      { ordered: false },
    );
  } catch (err) {
    // E11000 (raceId,userId уже в журнале) — гонка с этим userId уже обработана:
    // остальные записи батча insertMany уже вставлены, дубликаты просто пропускаем
    if (err?.code === 11000 || (Array.isArray(err?.writeErrors) && err.writeErrors.every((e) => e?.code === 11000))) {
      return { ok: true, duplicates: true };
    }
    throw err;
  }
}

module.exports = { findSentUserIds, markSent };
