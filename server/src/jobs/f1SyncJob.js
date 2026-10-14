'use strict';

require('../config/env');

const cron = require('node-cron');
const { syncSeason } = require('../services/f1SyncService');

function isEnabled() {
  return String(process.env.SYNC_CRON_ENABLED || '').toLowerCase() === 'true';
}

function start() {
  if (!isEnabled()) {
    console.log('[f1SyncJob] disabled (set SYNC_CRON_ENABLED=true to enable)');
    return null;
  }

  const schedule = process.env.SYNC_CRON_SCHEDULE || '0 6 * * *';
  if (!cron.validate(schedule)) {
    console.error(`[f1SyncJob] invalid cron schedule: "${schedule}"`);
    return null;
  }

  const task = cron.schedule(schedule, async () => {
    const season = Number(process.env.SYNC_SEASON) || new Date().getFullYear();
    try {
      const summary = await syncSeason(season);
      console.log(`[f1SyncJob] synced season ${season}:`, JSON.stringify(summary));
    } catch (err) {
      console.error('[f1SyncJob] sync failed:', err.message);
    }
  });

  console.log(`[f1SyncJob] scheduled "${schedule}" (season ${process.env.SYNC_SEASON || 'current'})`);
  return task;
}

module.exports = { start, isEnabled };
