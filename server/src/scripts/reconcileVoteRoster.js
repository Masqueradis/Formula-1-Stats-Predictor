'use strict';

/**
 * Эпик-13 (BUG-08), вариант A «Последняя гонка» — сверка `season_teams`.
 *
 * Помечает `isReserve` по фактическому составу последней завершённой гонки:
 *   - участник последней гонки → isReserve=false;
 *   - остальные (резервисты, тест-пилоты, замены вне гонки) → true;
 *   - дубль пилота в двух командах: боевым остаётся только тот, за который
 *     он выступал в последней гонке, остальные строки → резерв.
 * Если завершённых гонок нет — fallback на заявку: не более двух боевых
 * пилотов на команду, остальные → резерв.
 *
 * По умолчанию dry-run: печатает план и ничего не меняет.
 * Запись в БД — только с явным флагом:
 *
 *   npm run reconcile:vote-roster -- --season 2026
 *   npm run reconcile:vote-roster -- --season 2026 --apply
 */

require('../config/env');

const { sequelize, SeasonTeam, Race, RaceResult } = require('../models');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');

function argValue(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  return value && !value.startsWith('--') ? value : null;
}

function label(row) {
  const driver = row.driver
    ? `${row.driver.firstName || ''} ${row.driver.lastName || ''}`.trim()
    : `driver#${row.driverId}`;
  const team = row.team ? row.team.name : `team#${row.teamId}`;
  return `${driver} (${team})`;
}

/**
 * План: Map<seasonTeamId, { isReserve, reason }>.
 * Возвращает также предупреждения (участник гонки без строки season_teams).
 */
async function buildPlan(season) {
  const rows = await SeasonTeam.findAll({
    where: { season },
    include: [{ association: 'driver' }, { association: 'team' }],
    order: [['id', 'ASC']],
  });

  const plan = new Map();
  const warnings = [];

  const lastRace = await Race.findOne({
    where: { season, status: 'finished' },
    order: [['round', 'DESC'], ['date', 'DESC']],
  });

  if (lastRace) {
    const results = await RaceResult.findAll({
      where: { raceId: lastRace.id, sessionType: 'race' },
      order: [['position', 'ASC']],
    });

    // driverId → teamId последней гонки (первое вхождение)
    const participantTeam = new Map();
    for (const result of results) {
      if (!participantTeam.has(Number(result.driverId))) {
        participantTeam.set(Number(result.driverId), result.teamId == null ? null : Number(result.teamId));
      }
    }

    const keptDriver = new Set();
    const sorted = [...rows].sort((a, b) => {
      const seasonOrder = (Number(b.season) || 0) - (Number(a.season) || 0);
      if (seasonOrder !== 0) return seasonOrder;
      return (Number(a.id) || 0) - (Number(b.id) || 0);
    });

    for (const row of sorted) {
      const driverId = Number(row.driverId);
      if (!participantTeam.has(driverId)) {
        plan.set(Number(row.id), {
          isReserve: true,
          reason: 'не участвовал в последней завершённой гонке',
        });
        continue;
      }
      if (keptDriver.has(driverId)) {
        plan.set(Number(row.id), {
          isReserve: true,
          reason: 'дубль: пилот уже заявлен в другой команде',
        });
        continue;
      }
      const expectedTeamId = participantTeam.get(driverId);
      if (expectedTeamId != null && Number(row.teamId) !== expectedTeamId) {
        plan.set(Number(row.id), {
          isReserve: true,
          reason: `дубль: в последней гонке выступал за team#${expectedTeamId}`,
        });
        continue;
      }
      keptDriver.add(driverId);
      plan.set(Number(row.id), {
        isReserve: false,
        reason: lastRace ? `участник гонки R${lastRace.round}` : 'заявка сезона',
      });
    }

    for (const [driverId, teamId] of participantTeam) {
      if (!rows.some((row) => Number(row.driverId) === driverId)) {
        warnings.push(`driver#${driverId} (team#${teamId}) есть в результатах, но нет в season_teams`);
      }
    }
  } else {
    // Fallback: до первой завершённой гонки — по два боевых пилота на команду.
    const perTeam = new Map();
    const seenDriver = new Set();
    for (const row of rows) {
      const driverId = Number(row.driverId);
      const teamId = Number(row.teamId);
      if (seenDriver.has(driverId)) {
        plan.set(Number(row.id), { isReserve: true, reason: 'дубль пилота в заявке сезона' });
        continue;
      }
      seenDriver.add(driverId);
      const count = perTeam.get(teamId) || 0;
      if (count >= 2) {
        plan.set(Number(row.id), { isReserve: true, reason: 'третий и далее пилот команды в заявке' });
        continue;
      }
      perTeam.set(teamId, count + 1);
      plan.set(Number(row.id), { isReserve: false, reason: 'заявка сезона (гонок ещё нет)' });
    }
  }

  return { rows, plan, warnings, lastRace };
}

(async () => {
  const requestedSeason = Number(argValue('--season'));
  const latest = await SeasonTeam.max('season');
  const season = Number.isInteger(requestedSeason) && requestedSeason > 0
    ? requestedSeason
    : Number(latest) || new Date().getFullYear();

  const { rows, plan, warnings, lastRace } = await buildPlan(season);

  console.log(`[reconcile:vote-roster] season=${season}, rows=${rows.length}, ` +
    `lastRace=${lastRace ? `R${lastRace.round} #${lastRace.id}` : 'нет'}`);
  console.log(`[reconcile:vote-roster] режим: ${APPLY ? 'APPLY (изменения будут записаны)' : 'DRY-RUN (без изменений)'}`);

  const changes = [];
  for (const row of rows) {
    const target = plan.get(Number(row.id));
    if (!target) continue;
    if (Boolean(row.isReserve) !== target.isReserve) {
      changes.push({ row, target });
    }
  }

  if (changes.length === 0) {
    console.log('[reconcile:vote-roster] расхождений нет');
  } else {
    console.log(`[reconcile:vote-roster] изменения (${changes.length}):`);
    for (const { row, target } of changes) {
      console.log(`  #${row.id} ${label(row)}: isReserve ${Boolean(row.isReserve)} → ${target.isReserve} — ${target.reason}`);
    }
  }

  for (const warning of warnings) console.warn(`  ! ${warning}`);

  if (APPLY && changes.length) {
    await sequelize.transaction(async (transaction) => {
      for (const { row, target } of changes) {
        await row.update({ isReserve: target.isReserve }, { transaction });
      }
    });
    console.log(`[reconcile:vote-roster] записано изменений: ${changes.length}`);
  } else if (!APPLY && changes.length) {
    console.log('[reconcile:vote-roster] это dry-run; для записи добавьте --apply');
  }
})().catch((err) => {
  console.error('[reconcile:vote-roster] failed:', err.message);
  process.exitCode = 1;
}).finally(async () => {
  await sequelize.close();
});
