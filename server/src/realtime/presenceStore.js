'use strict';

/**
 * Presence для Socket.IO (эпик-11).
 *
 * Redis hash `f1:presence:clients`: field = socketId, value = JSON
 * `{ userId, username, role, raceId, updatedAt }`. Это позволяет считать
 * presence при нескольких backend-инстансах. Если Redis выключен/недоступен,
 * используется локальный Map — single-instance режим.
 */

const redisClient = require('../cache/redisClient');
const cacheKeys = require('../cache/keys');
const logger = require('../utils/logger');

const STALE_MS = 60 * 1000;
const KEY = cacheKeys.presence();

// socketId -> entry (L1/fallback)
const local = new Map();
// socketId -> Promise: операции одного сокета выполняются строго по очереди,
// иначе поздний update() может перезаписать уже удалённую запись (фантомы).
const pending = new Map();
let fallbackLogged = false;

function enqueue(socketId, task) {
  const previous = pending.get(socketId) || Promise.resolve();
  const next = previous.catch(() => {}).then(task);
  pending.set(socketId, next);
  next
    .finally(() => {
      if (pending.get(socketId) === next) pending.delete(socketId);
    })
    .catch(() => {});
  return next;
}

function warnFallback(err) {
  if (fallbackLogged) return;
  fallbackLogged = true;
  logger.warn('presence.redis_fallback', { reason: err.message });
}

function withTimestamp(data = {}) {
  return {
    userId: data.userId ?? null,
    username: data.username || 'Гость',
    role: data.role || null,
    raceId: data.raceId == null ? null : String(data.raceId),
    updatedAt: Number(data.updatedAt) || Date.now(),
  };
}

async function register(socketId, data = {}) {
  return enqueue(socketId, async () => {
    const entry = withTimestamp(data);
    local.set(socketId, entry);

    const client = await redisClient.getClient();
    if (!client) return;
    try {
      await client.hSet(KEY, socketId, JSON.stringify(entry));
    } catch (err) {
      warnFallback(err);
    }
  });
}

async function update(socketId, patch = {}) {
  return enqueue(socketId, async () => {
    // Сокет уже отключён — запоздавший heartbeat/update не должен воскрешать запись.
    if (!local.has(socketId)) return;

    const current = local.get(socketId) || {};
    const entry = withTimestamp({ ...current, ...patch });
    local.set(socketId, entry);

    const client = await redisClient.getClient();
    if (!client) return;
    try {
      const raw = await client.hGet(KEY, socketId);
      let remote = {};
      if (raw) {
        try {
          remote = JSON.parse(raw);
        } catch {
          remote = {};
        }
      }
      await client.hSet(KEY, socketId, JSON.stringify(withTimestamp({ ...remote, ...entry })));
    } catch (err) {
      warnFallback(err);
    }
  });
}

async function unregister(socketId) {
  return enqueue(socketId, async () => {
    local.delete(socketId);

    const client = await redisClient.getClient();
    if (!client) return;
    try {
      await client.hDel(KEY, socketId);
    } catch (err) {
      warnFallback(err);
    }
  });
}

async function heartbeat(socketId) {
  await update(socketId, { updatedAt: Date.now() });
}

async function readAll() {
  const client = await redisClient.getClient();
  if (client) {
    try {
      const hash = await client.hGetAll(KEY);
      return Object.entries(hash)
        .map(([socketId, raw]) => {
          try {
            return { socketId, ...JSON.parse(raw) };
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch (err) {
      warnFallback(err);
    }
  }

  return [...local.entries()].map(([socketId, data]) => ({ socketId, ...data }));
}

async function summary(raceId = null) {
  const entries = await readAll();
  const now = Date.now();
  const valid = entries.filter((entry) => now - Number(entry.updatedAt || 0) <= STALE_MS);

  const users = new Set();
  let guests = 0;
  let raceConnections;
  if (raceId != null) raceConnections = 0;

  for (const entry of valid) {
    if (entry.userId != null) users.add(entry.userId);
    else guests += 1;
    if (raceId != null && String(entry.raceId) === String(raceId)) raceConnections += 1;
  }

  return {
    connections: valid.length,
    guests,
    users: [...users],
    usersCount: users.size,
    raceConnections,
  };
}

/** Удалить устаревшие записи (упавший инстанс, потерянный disconnect). */
async function cleanup() {
  const now = Date.now();

  for (const [socketId, entry] of local.entries()) {
    if (now - Number(entry.updatedAt || 0) > STALE_MS) local.delete(socketId);
  }

  const client = await redisClient.getClient();
  if (!client) return;
  try {
    const hash = await client.hGetAll(KEY);
    const stale = Object.entries(hash)
      .filter(([, raw]) => {
        try {
          const entry = JSON.parse(raw);
          return now - Number(entry.updatedAt || 0) > STALE_MS;
        } catch {
          return true;
        }
      })
      .map(([socketId]) => socketId);
    if (stale.length) await client.hDel(KEY, stale);
  } catch (err) {
    warnFallback(err);
  }
}

function __reset() {
  local.clear();
  pending.clear();
  fallbackLogged = false;
}

module.exports = { register, update, unregister, heartbeat, summary, cleanup, __reset };
