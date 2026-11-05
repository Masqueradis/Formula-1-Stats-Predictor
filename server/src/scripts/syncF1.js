'use strict';

require('../config/env');

const { sequelize } = require('../models');
const { syncSeason } = require('../services/f1SyncService');
const jolpicaClient = require('../clients/jolpicaClient');

const season = Number(process.argv[2]) || new Date().getFullYear();

(async () => {
  try {
    // Ручной синк — принудительно свежие данные, без ответов предыдущего прогона.
    await jolpicaClient.clearCache();
    const summary = await syncSeason(season);
    console.log('[sync:f1] completed:', JSON.stringify(summary));
    if (summary.errors.length) {
      console.error(`[sync:f1] ${summary.errors.length} error(s):`);
      for (const error of summary.errors) console.error(`  - ${error}`);
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('[sync:f1] failed:', err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
