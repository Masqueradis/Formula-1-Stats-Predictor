'use strict';

/**
 * Единственный Redis-клиент приложения (эпик-11).
 *
 * Redis — деградируемая зависимость:
 * - `NODE_ENV=test` или `REDIS_ENABLED=false` → слой выключен;
 * - нет `REDIS_URL` → слой выключен;
 * - Redis недоступен → одно предупреждение и fallback на память
 *   (реализован в cacheService), процесс не падает.
 */

const { createClient } = require('redis');
const logger = require('../utils/logger');

let client = null;
let connectPromise = null;
let lastFailureAt = 0;

// Не пытаемся переподключаться на каждый запрос, если Redis лежит.
const RETRY_COOLDOWN_MS = 30 * 1000;
const CONNECT_TIMEOUT_MS = 1200;
const PING_TIMEOUT_MS = 500;

function isEnabled() {
  if (process.env.NODE_ENV === 'test') return false;
  if (String(process.env.REDIS_ENABLED || '').toLowerCase() === 'false') return false;
  return Boolean(process.env.REDIS_URL);
}

function createRedisClient(url) {
  const instance = createClient({
    url,
    disableOfflineQueue: true,
    socket: {
      reconnectStrategy: (retries) => Math.min(3000, 100 * 2 ** Math.min(retries, 5)),
    },
  });

  // node-redis требует обработчик error, иначе событие считается unhandled.
  // Во время неудачного connect событие приходит на каждую попытку — логируем
  // только первую, чтобы не засорять Loki.
  let errorLogged = false;
  let connected = false;

  instance.on('ready', () => {
    connected = true;
    errorLogged = false;
  });
  instance.on('error', (err) => {
    if (errorLogged) return;
    errorLogged = true;
    logger.warn('redis.error', { reason: err.message });
  });
  instance.on('end', () => {
    if (connected) logger.warn('redis.disconnected');
    connected = false;
  });

  return instance;
}

async function connect() {
  if (!isEnabled()) return null;
  if (client && client.isOpen) return client;
  if (client) {
    try {
      client.disconnect();
    } catch {
      // ignore
    }
    client = null;
  }
  if (connectPromise) return connectPromise;
  if (Date.now() - lastFailureAt < RETRY_COOLDOWN_MS) return null;

  connectPromise = (async () => {
    let instance = null;
    let timer = null;
    try {
      instance = createRedisClient(process.env.REDIS_URL);
      const task = instance.connect();
      // При недоступном Redis connect() может ретраиться бесконечно — ограничиваем.
      task.catch(() => {});

      const connected = await Promise.race([
        task.then(() => true),
        new Promise((resolve) => {
          timer = setTimeout(() => resolve(false), CONNECT_TIMEOUT_MS);
        }),
      ]);
      if (timer) clearTimeout(timer);

      if (!connected) {
        lastFailureAt = Date.now();
        logger.warn('redis.unavailable', { reason: 'connect timeout' });
        try {
          instance.disconnect();
        } catch {
          // клиент мог не успеть создать соединение
        }
        return null;
      }

      client = instance;
      logger.info('redis.connected');
      return client;
    } catch (err) {
      lastFailureAt = Date.now();
      logger.warn('redis.unavailable', { reason: err.message });
      if (instance) {
        try {
          instance.disconnect();
        } catch {
          // ignore
        }
      }
      return null;
    } finally {
      if (timer) clearTimeout(timer);
      connectPromise = null;
    }
  })();

  return connectPromise;
}

async function getClient() {
  if (!isEnabled()) return null;
  if (client && client.isOpen) return client;
  return connect();
}

async function ping() {
  const instance = await getClient();
  if (!instance) return false;

  let timer = null;
  try {
    const result = await Promise.race([
      instance.ping().then((value) => value === 'PONG'),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), PING_TIMEOUT_MS);
      }),
    ]);
    return result;
  } catch (err) {
    logger.warn('redis.ping_failed', { reason: err.message });
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function duplicate() {
  const instance = await getClient();
  if (!instance) return null;
  return instance.duplicate();
}

async function close() {
  const instance = client;
  client = null;
  if (!instance) return;
  try {
    if (instance.isOpen) await instance.quit();
  } catch {
    instance.disconnect();
  }
}

module.exports = { isEnabled, connect, getClient, ping, duplicate, close };
