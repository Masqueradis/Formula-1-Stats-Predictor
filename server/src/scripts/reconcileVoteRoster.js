'use strict';

/**
 * Эпик-13 (BUG-08), вариант A «Последняя гонка» — CLI сверки `season_teams`.
 *
 * По умолчанию dry-run: печатает план и ничего не меняет.
 * Запись в БД — только с явным флагом:
 *
 *   npm run reconcile:vote-roster -- --season 2026
 *   npm run reconcile:vote-roster -- --season 2026 --apply
 *
 * Логика сверки вынесена в services/voteRosterService.js и переиспользуется
 * автоматически после syncSeason.
 */

require('../config/env');

const { sequelize, SeasonTeam } = require('../models');
const { reconcileVoteRoster } = require('../services/voteRosterService');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');

function argValue(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  return value && !value.startsWith('--') ? value : null;
}

(async () => {
  const requestedSeason = Number(argValue('--season'));
  const latest = await SeasonTeam.max('season');
  const season = Number.isInteger(requestedSeason) && requestedSeason > 0
    ? requestedSeason
    : Number(latest) || new Date().getFullYear();

  const result = await reconcileVoteRoster(season, { apply: APPLY });

  console.log(`[reconcile:vote-roster] season=${season}, rows=${result.rows.length}, ` +
    `lastRace=${result.lastRace ? `R${result.lastRace.round} #${result.lastRace.id}` : 'нет'}`);
  console.log(`[reconcile:vote-roster] режим: ${APPLY ? 'APPLY (изменения будут записаны)' : 'DRY-RUN (без изменений)'}`);

  if (result.changes.length === 0) {
    console.log('[reconcile:vote-roster] расхождений нет');
  } else {
    console.log(`[reconcile:vote-roster] изменения (${result.changes.length}):`);
    for (const { row, target, label } of result.changes) {
      console.log(`  #${row.id} ${label}: isReserve ${Boolean(row.isReserve)} → ${target.isReserve} — ${target.reason}`);
    }
  }

  for (const warning of result.warnings) console.warn(`  ! ${warning}`);

  if (result.applied) {
    console.log(`[reconcile:vote-roster] записано изменений: ${result.changes.length}`);
  } else if (!APPLY && result.changes.length) {
    console.log('[reconcile:vote-roster] это dry-run; для записи добавьте --apply');
  }
})().catch((err) => {
  console.error('[reconcile:vote-roster] failed:', err.message);
  process.exitCode = 1;
}).finally(async () => {
  await sequelize.close();
});
