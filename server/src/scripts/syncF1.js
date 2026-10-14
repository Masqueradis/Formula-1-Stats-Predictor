'use strict';

require('../config/env');

const { sequelize } = require('../models');
const { syncSeason } = require('../services/f1SyncService');

const season = Number(process.argv[2]) || new Date().getFullYear();

syncSeason(season)
  .then((summary) => {
    console.log('[sync:f1] completed:', JSON.stringify(summary));
    if (summary.errors.length) {
      console.error(`[sync:f1] ${summary.errors.length} error(s):`);
      for (const error of summary.errors) console.error(`  - ${error}`);
      process.exitCode = 1;
    }
  })
  .catch((err) => {
    console.error('[sync:f1] failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
