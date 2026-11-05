'use strict';

/**
 * Кэш-слой приложения (эпик-11).
 *
 * Основное хранилище — Redis; если он выключен или недоступен, прозрачно
 * используется in-memory Map с тем же API и TTL. Значения сериализуются в JSON.
 */

const redisClient = require('./redisClient');
const logger = require('../utils/logger');

// key -> { value, expiresAt }
const memory = new Map();
let fallbackLogged = false;

function warnFallback(err) {
  if (fallbackLogged) return;
  fallbackLogged = true;
  logger.warn('cache.redis_fallback', { reason: err.message });
}

function readMemory(key) {
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return entry.value;
}

function writeMemory(key, value, ttlMs) {
  const expiresAt = ttlMs > 0 ? Date.now() + ttlMs : 0;
  memory.set(key, { value, expiresAt });
}

function deleteMemoryByPrefix(prefix) {
  for (const key of memory.keys()) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
}

async function get(key) {
  const client = await redisClient.getClient();
  if (client) {
    try {
      const raw = await client.get(key);
      if (raw == null) return null;
      try {
        return JSON.parse(raw);
      } catch {
        await client.del(key);
        return null;
      }
    } catch (err) {
      warnFallback(err);
    }
  }
  return readMemory(key);
}

async function set(key, value, ttlMs) {
  const client = await redisClient.getClient();
  if (client) {
    try {
      const raw = JSON.stringify(value);
      if (ttlMs > 0) await client.set(key, raw, { PX: ttlMs });
      else await client.set(key, raw);
      return true;
    } catch (err) {
      warnFallback(err);
    }
  }
  writeMemory(key, value, ttlMs);
  return false;
}

async function del(key) {
  const client = await redisClient.getClient();
  if (client) {
    try {
      await client.del(key);
    } catch (err) {
      warnFallback(err);
    }
  }
  memory.delete(key);
}

async function delByPrefix(prefix) {
  const client = await redisClient.getClient();
  if (client) {
    try {
      const keys = [];
      for await (const key of client.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
        keys.push(key);
      }
      // UNLINK освобождает память в фоне и не блокирует Redis, в отличие от DEL.
      for (let i = 0; i < keys.length; i += 100) {
        await client.unlink(keys.slice(i, i + 100));
      }
    } catch (err) {
      warnFallback(err);
    }
  }
  deleteMemoryByPrefix(prefix);
}

/**
 * Вернуть значение из кэша или загрузить и сохранить его.
 * @returns {Promise<{ value: unknown, cached: boolean }>}
 */
async function getOrSet(key, ttlMs, loader) {
  const cached = await get(key);
  if (cached !== null && cached !== undefined) {
    return { value: cached, cached: true };
  }

  const value = await loader();
  if (value !== undefined) {
    await set(key, value, ttlMs);
  }
  return { value, cached: false };
}

async function ping() {
  return redisClient.ping();
}

function isEnabled() {
  return redisClient.isEnabled();
}

/** Сброс in-memory слоя (для тестов). Redis не трогаем. */
function __reset() {
  memory.clear();
  fallbackLogged = false;
}

module.exports = { get, set, del, delByPrefix, getOrSet, ping, isEnabled, __reset };
