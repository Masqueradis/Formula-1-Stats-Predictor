'use strict';

const { createAdapter } = require('@socket.io/redis-adapter');
const redisClient = require('../cache/redisClient');
const logger = require('../utils/logger');

const PUBLISH_WARN_COOLDOWN_MS = 10 * 1000;
let lastPublishWarnAt = 0;

function warnPublishFailed(err) {
  const now = Date.now();
  if (now - lastPublishWarnAt < PUBLISH_WARN_COOLDOWN_MS) return;
  lastPublishWarnAt = now;
  logger.warn('realtime.redis_publish_failed', { reason: err.message });
}

function guardAsyncMethod(target, method) {
  if (!target || typeof target[method] !== 'function') return;
  const original = target[method].bind(target);
  target[method] = (...args) => {
    try {
      const result = original(...args);
      if (result && typeof result.catch === 'function') {
        return result.catch((err) => {
          warnPublishFailed(err);
          return 0;
        });
      }
      return result;
    } catch (err) {
      warnPublishFailed(err);
      return Promise.resolve(0);
    }
  };
}

function guardClient(client) {
  guardAsyncMethod(client, 'publish');
  guardAsyncMethod(client, 'pSubscribe');
  guardAsyncMethod(client, 'subscribe');
  guardAsyncMethod(client, 'pUnsubscribe');
  guardAsyncMethod(client, 'unsubscribe');
}

async function setupRedisAdapter(io) {
  if (!redisClient.isEnabled()) return false;

  const base = await redisClient.connect();
  if (!base) return false;

  const pubClient = await redisClient.duplicate();
  const subClient = await redisClient.duplicate();
  if (!pubClient || !subClient) return false;

  guardClient(pubClient);
  guardClient(subClient);

  const onError = (err) => logger.warn('realtime.redis_adapter_error', { reason: err.message });
  pubClient.on('error', onError);
  subClient.on('error', onError);

  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('realtime.redis_adapter', { status: 'enabled' });
    return true;
  } catch (err) {
    logger.warn('realtime.redis_adapter_unavailable', { reason: err.message });
    try {
      pubClient.disconnect();
      subClient.disconnect();
    } catch {
    }
    return false;
  }
}

module.exports = { setupRedisAdapter };
