'use strict';

/**
 * Эпик-10: бэкфилл исторических сезонов Jolpica.
 *
 *   npm run sync:history -- 2000 2025              # диапазон + текущий сезон
 *   npm run sync:history -- 2000 2025 --no-current # только диапазон
 *   npm run sync:history -- 2013                   # один сезон
 *
 * Идемпотентно: повторный запуск обновляет существующие записи.
 */

require('../config/env');

const { sequelize } = require('../models');
const { syncSeason, refreshActiveFlags } = require('../services/f1SyncService');

const args = process.argv.slice(2);
const noCurrent = args.includes('--no-current');
const years = args
  .filter((arg) => /^\d{4}$/.test(arg))
  .map(Number)
  .sort((a, b) => a - b);

const currentYear = new Date().getFullYear();
const start = years[0] || 2000;
const end = years[1] || Math.min(currentYear - 1, 2025);

async function run() {
  if (start > end) throw new Error(`invalid range: ${start} > ${end}`);

  const totals = { races: 0, results: 0, teams: 0, drivers: 0, seasonTeams: 0, errors: [] };
  console.log(`[sync:history] seasons ${start}–${end}`);

  for (let season = start; season <= end; season += 1) {
    try {
      const summary = await syncSeason(season, { refreshActive: false });
      totals.races += summary.races;
      totals.results += summary.results;
      totals.teams += summary.teams;
      totals.drivers += summary.drivers;
      totals.seasonTeams += summary.seasonTeams;
      totals.errors.push(...summary.errors);
      console.log(
        `  ${season}: races=${summary.races} results=${summary.results} ` +
          `teams=${summary.teams} drivers=${summary.drivers} seasonTeams=${summary.seasonTeams} ` +
          `errors=${summary.errors.length}`,
      );
    } catch (err) {
      totals.errors.push(`${season}: ${err.message}`);
      console.error(`  ${season}: FAILED — ${err.message}`);
    }
  }

  if (!noCurrent) {
    try {
      const summary = await syncSeason(currentYear, { refreshActive: false });
      totals.races += summary.races;
      totals.results += summary.results;
      totals.teams += summary.teams;
      totals.drivers += summary.drivers;
      totals.seasonTeams += summary.seasonTeams;
      totals.errors.push(...summary.errors);
      console.log(
        `  ${currentYear}: races=${summary.races} results=${summary.results} ` +
          `teams=${summary.teams} drivers=${summary.drivers} seasonTeams=${summary.seasonTeams} ` +
          `errors=${summary.errors.length}`,
      );
    } catch (err) {
      totals.errors.push(`${currentYear}: ${err.message}`);
      console.error(`  ${currentYear}: FAILED — ${err.message}`);
    }
  }

  const active = await refreshActiveFlags();
  console.log('[sync:history] active flags:', JSON.stringify(active));
  console.log('[sync:history] totals:', JSON.stringify({
    races: totals.races,
    results: totals.results,
    teams: totals.teams,
    drivers: totals.drivers,
    seasonTeams: totals.seasonTeams,
    errors: totals.errors.length,
  }));

  if (totals.errors.length) {
    console.error(`[sync:history] ${totals.errors.length} error(s):`);
    for (const error of totals.errors) console.error(`  - ${error}`);
    process.exitCode = 1;
  }
}

run()
  .catch((err) => {
    console.error('[sync:history] failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
