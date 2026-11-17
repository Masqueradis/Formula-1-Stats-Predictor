'use strict';

const EmailReminder = require('../models/mongo/emailReminder');

async function findSentUserIds(raceId) {
  const rows = await EmailReminder.find({ raceId }).select('userId').lean().exec();
  return new Set(rows.map((row) => row.userId));
}

async function markSent(raceId, userIds) {
  if (!userIds.length) return null;
  const now = new Date();
  try {
    return await EmailReminder.insertMany(
      userIds.map((userId) => ({ raceId, userId, sentAt: now })),
      { ordered: false },
    );
  } catch (err) {
    if (err?.code === 11000 || (Array.isArray(err?.writeErrors) && err.writeErrors.every((e) => e?.code === 11000))) {
      return { ok: true, duplicates: true };
    }
    throw err;
  }
}

module.exports = { findSentUserIds, markSent };
