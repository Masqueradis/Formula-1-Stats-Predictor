'use strict';

const mongoose = require('mongoose');

const RETRY_MS = 10_000;
const CONNECT_TIMEOUT_MS = 5_000;

let retryTimer = null;
let closing = false; // флаг штатного закрытия — ретраи не нужны

/**
 * Статус MongoDB для /api/health и middleware.
 * Деградированный режим: сервер стартует и работает без Mongo,
 * а /api/predictions отдаёт 503 (см. middleware/requireMongo).
 */
function status() {
  return mongoose.connection.readyState === 1 ? 'up' : 'down';
}

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(async () => {
    retryTimer = null;
    await connectMongo();
  }, RETRY_MS);
}

async function connectMongo() {
  if (closing) return;
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.warn('[mongo] MONGO_URI is not set — predictions API will return 503');
    return;
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS });
    console.log('MongoDB connected');
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message} — retry in ${RETRY_MS}ms`);
    scheduleRetry();
  }
}

mongoose.connection.on('disconnected', () => {
  if (closing) return; // штатное закрытие (disconnectMongo) — без ретраев
  console.warn('[mongo] disconnected — retry scheduled');
  scheduleRetry();
});

async function disconnectMongo() {
  closing = true;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
}

module.exports = { connectMongo, disconnectMongo, status };
