'use strict';

require('../config/env');

/**
 * UC-2 — cron-джоба начисления баллов по результатам завершённых гонок
 * и пересчёта рейтинга предсказателей (US-6).
 *
 * - сразу при старте (чтобы рейтинг не был пуст после ребута) — триггер 'startup';
 * - далее по расписанию (по умолчанию каждые 10 минут, LEADERBOARD_CRON_SCHEDULE);
 * - при изменениях рассылает Socket.IO: 'leaderboard:update' (новое событие)
 *   и 'standings:update' (как этого требует формулировка UC-2).
 */

const cron = require('node-cron');
const { recalculate } = require('../services/leaderboardService');
const realtime = require('../realtime/io');

function isEnabled() {
  const raw = process.env.LEADERBOARD_CRON_ENABLED;
  // По умолчанию включено: фича не должна зависеть от наличия env на стенде
  return (raw === undefined ? 'true' : raw).toLowerCase() === 'true';
}

async function run(trigger) {
  try {
    const summary = await recalculate();
    if (summary.votes > 0) {
      console.log(`[leaderboardJob] ${trigger}: scored ${summary.votes} vote(s) in ${summary.races} race(s)`);
      realtime.emitLeaderboard({ action: trigger, ...summary });
      realtime.emitStandings({ action: 'leaderboard-recalc', ...summary });
    }
    return summary;
  } catch (err) {
    console.error(`[leaderboardJob] ${trigger} failed:`, err.message);
    return { races: 0, votes: 0 };
  }
}

function start() {
  if (!isEnabled()) {
    console.log('[leaderboardJob] disabled (set LEADERBOARD_CRON_ENABLED=true to enable)');
    return null;
  }

  const schedule = process.env.LEADERBOARD_CRON_SCHEDULE || '*/10 * * * *';
  if (!cron.validate(schedule)) {
    console.error(`[leaderboardJob] invalid cron schedule: "${schedule}"`);
    return null;
  }

  run('startup');
  const task = cron.schedule(schedule, () => run('cron'));

  console.log(`[leaderboardJob] scheduled "${schedule}" (rule: exact ${3}, podium ${1})`);
  return task;
}

module.exports = { start, isEnabled, run };
