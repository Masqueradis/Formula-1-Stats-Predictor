'use strict';

const mongoose = require('mongoose');

const emailReminderSchema = new mongoose.Schema({
  raceId: { type: String, required: true },
  userId: { type: Number, required: true },
  sentAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
  collection: 'email_reminders',
});

emailReminderSchema.index({ raceId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('EmailReminder', emailReminderSchema);
