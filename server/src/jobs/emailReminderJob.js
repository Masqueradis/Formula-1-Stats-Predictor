'use strict';

require('../config/env');

const cron = require('node-cron');
const { sendUpcomingReminders } = require('../services/raceReminderService');

function isEnabled() {
  const raw = process.env.EMAIL_REMINDER_CRON_ENABLED;
  return (raw === undefined ? 'true' : raw).toLowerCase() === 'true';
}

async function run(trigger) {
  try {
    const summary = await sendUpcomingReminders();
    if (summary.sent > 0 || summary.races > 0) {
      console.log(`[emailReminderJob] ${trigger}: ${summary.sent} reminder(s) in ${summary.races} race window(s)`);
    }
    return summary;
  } catch (err) {
    console.error(`[emailReminderJob] ${trigger} failed:`, err.message);
    return { races: 0, sent: 0 };
  }
}

function start() {
  if (!isEnabled()) {
    console.log('[emailReminderJob] disabled (set EMAIL_REMINDER_CRON_ENABLED=true to enable)');
    return null;
  }

  const schedule = process.env.EMAIL_REMINDER_CRON_SCHEDULE || '0 * * * *';
  if (!cron.validate(schedule)) {
    console.error(`[emailReminderJob] invalid cron schedule: "${schedule}"`);
    return null;
  }

  run('startup');
  const task = cron.schedule(schedule, () => run('cron'));

  console.log(`[emailReminderJob] scheduled "${schedule}" (24h before race, favorites only)`);
  return task;
}

module.exports = { start, isEnabled, run };
