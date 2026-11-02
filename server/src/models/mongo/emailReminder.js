'use strict';

const mongoose = require('mongoose');

/**
 * Журнал отправленных email-напоминаний о гонке (эпик-09, todo 7).
 *
 * Одна запись = одному пользователю отправлено напоминание о конкретной гонке.
 * Уникальный индекс (raceId, userId) гарантирует идемпотентность cron-джобы:
 * повторные прогоны не шлют дубли писем.
 */
const emailReminderSchema = new mongoose.Schema({
  raceId: { type: String, required: true }, // races.externalId | String(races.id)
  userId: { type: Number, required: true }, // users.id (PostgreSQL)
  sentAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
  collection: 'email_reminders',
});

emailReminderSchema.index({ raceId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('EmailReminder', emailReminderSchema);
