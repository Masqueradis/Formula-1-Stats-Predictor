'use strict';

require('../config/env');

const { sequelize } = require('../models');
const { connectMongo, disconnectMongo, status } = require('../config/mongo');
const predictionService = require('../services/predictionService');
const predictionRepository = require('../repositories/predictionRepository');
const userRepository = require('../repositories/userRepository');

/**
 * Демо-данные в MongoDB для отчёта/повторного прогона testing.md:
 * документ следующей ГП + голоса (полные перестановки 1..N) + комментарии.
 * Идемпотентно: голос пользователя, уже существующий в документе, пропускается.
 */

const DEMO_COMMENTS = [
  'Народный прогноз обновился — смотрите средние места по пилотам!',
  'Кажется, в этот уик-энд всё решит квалификация.',
];

function shuffled(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function main() {
  await connectMongo();
  if (status() !== 'up') {
    throw new Error('MongoDB is unavailable — check MONGO_URI / docker compose');
  }

  // Документ следующей гонки (ленивый create из PostgreSQL)
  const doc = await predictionService.getNext();
  console.log(`[seed:mongo] race ${doc.raceId} (${doc.raceName}), entries: ${doc.entries.length}`);

  // Голоса от существующих демо-пользователей (users из PostgreSQL seed)
  const demoUsers = [];
  for (const username of ['maxfan', 'admin']) {
    const user = await userRepository.findByUsername(username);
    if (user) demoUsers.push(user);
  }
  if (!demoUsers.length) throw new Error('No demo users found — run `make seed` first');

  let votesAdded = 0;
  for (const user of demoUsers) {
    const picks = shuffled(doc.entries).map((e, i) => ({ driverId: e.driverId, position: i + 1 }));
    const updated = await predictionRepository.addVote(doc.raceId, {
      userId: user.id,
      username: user.username,
      kind: 'full',
      picks,
    });
    if (updated) votesAdded += 1;
    else console.log(`[seed:mongo] vote of "${user.username}" already exists — skipped`);
  }

  let commentsAdded = 0;
  const fresh = await predictionService.getByRaceId(doc.raceId);
  const author = demoUsers[0];
  if (!fresh.comments.some((c) => c.text === DEMO_COMMENTS[0])) {
    for (const text of DEMO_COMMENTS) {
      await predictionRepository.addComment(doc.raceId, {
        userId: author.id,
        username: author.username,
        text,
      });
      commentsAdded += 1;
    }
  }

  const final = await predictionService.getByRaceId(doc.raceId);
  console.log(`[seed:mongo] votes added: ${votesAdded}, comments added: ${commentsAdded}`);
  console.log(`[seed:mongo] totals: votes=${final.votes.length}, comments=${final.comments.length}`);
  console.log('[seed:mongo] nested structure check:');
  console.log(JSON.stringify({
    raceId: final.raceId,
    entriesSample: final.entries[0],
    voteSample: { ...final.votes[0], picks: final.votes[0].picks.slice(0, 3) },
    commentSample: final.comments[0],
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(`[seed:mongo] failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectMongo();
    await sequelize.close();
  });
