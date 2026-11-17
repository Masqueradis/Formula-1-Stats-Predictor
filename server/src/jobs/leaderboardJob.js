'use strict';

require('../config/env');

const cron = require('node-cron');
const { recalculate } = require('../services/leaderboardService');
const { invalidateApiCache } = require('../cache/invalidate');
const realtime = require('../realtime/io');

function isEnabled() {
  const raw = process.env.LEADERBOARD_CRON_ENABLED;
  return (raw === undefined ? 'true' : raw).toLowerCase() === 'true';
}

async function run(trigger) {
  try {
    const summary = await recalculate();
    if (summary.votes > 0) {
      console.log(`[leaderboardJob] ${trigger}: scored ${summary.votes} vote(s) in ${summary.races} race(s)`);
      await invalidateApiCache();
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
