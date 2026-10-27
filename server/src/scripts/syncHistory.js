'use strict';

/**
 * Эпик-10: бэкфилл истории Гран-при (по умолчанию 2000–2025).
 *
 * Запуск:
 *   npm run sync:history -- 2000 2025
 *   npm run sync:history -- 2010 2014 --no-current
 *
 * Скрипт идемпотентен: syncSeason обновляет существующие записи и пересоздаёт
 * результаты гонок. Ошибка одного сезона не останавливает остальные; в конце
 * печатается сводка и выставляется exit code 1, чтобы можно было перезапустить.
 */

require('../config/env');

const { sequelize } = require('../models');
const { syncSeason } = require('../services/f1SyncService');

const rawArgs = process.argv.slice(2);
const args = rawArgs.filter((arg) => !arg.startsWith('--'));
const currentYear = new Date().getFullYear();
const from = Number(args[0]) || 2000;
const to = Number(args[1]) || Math.min(currentYear, 2025);
const skipCurrent = rawArgs.includes('--no-current');

if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1950 || to < from) {
  console.error('[sync:history] usage: npm run sync:history -- <from> <to> [--no-current]');
  process.exit(1);
}

async function run() {
  console.log(`[sync:history] seasons ${from}–${to}`);
  const failed = [];
  const totals = { races: 0, results: 0, teams: 0, drivers: 0, seasonTeams: 0 };

  for (let season = from; season <= to; season += 1) {
    try {
      const summary = await syncSeason(season);
      totals.races += summary.races;
      totals.results += summary.results;
      totals.teams += summary.teams;
      totals.drivers += summary.drivers;
      totals.seasonTeams += summary.seasonTeams;
      console.log(
        `[sync:history] ${season}: races=${summary.races} results=${summary.results} ` +
        `drivers=${summary.drivers} teams=${summary.teams} errors=${summary.errors.length}`,
      );
      if (summary.errors.length) {
        for (const error of summary.errors) console.warn(`  - ${error}`);
      }
    } catch (err) {
      failed.push({ season, error: err.message });
      console.error(`[sync:history] ${season}: FAILED — ${err.message}`);
    }
  }

  // Текущий сезон не входит в исторический диапазон, но после бэкфилла
  // нужно пересчитать актуальные флаги/подиумы/результаты.
  if (!skipCurrent && currentYear > to) {
    try {
      const summary = await syncSeason(currentYear);
      console.log(
        `[sync:history] current ${currentYear}: races=${summary.races} ` +
        `results=${summary.results} errors=${summary.errors.length}`,
      );
      if (summary.errors.length) {
        for (const error of summary.errors) console.warn(`  - ${error}`);
      }
    } catch (err) {
      failed.push({ season: currentYear, error: err.message });
      console.error(`[sync:history] current ${currentYear}: FAILED — ${err.message}`);
    }
  }

  console.log('[sync:history] totals:', JSON.stringify(totals));
  if (failed.length) {
    console.error(`[sync:history] failed seasons: ${failed.length}`);
    for (const item of failed) console.error(`  - ${item.season}: ${item.error}`);
    process.exitCode = 1;
  }
}

run()
  .catch((err) => {
    console.error('[sync:history] unexpected failure:', err.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
