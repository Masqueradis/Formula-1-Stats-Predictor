'use strict';

const { createAdapter } = require('@socket.io/redis-adapter');
const redisClient = require('../cache/redisClient');
const logger = require('../utils/logger');

/**
 * Redis-адаптер Socket.IO (эпик-11).
 *
 * Позволяет нескольким backend-инстансам видеть комнаты и broadcast друг
 * друга. При недоступности Redis приложение продолжает работать в
 * single-instance режиме. Для нескольких инстансов нужны sticky sessions
 * на балансировщике — это ограничение документировано.
 */
async function setupRedisAdapter(io) {
  if (!redisClient.isEnabled()) return false;

  const base = await redisClient.connect();
  if (!base) return false;

  const pubClient = await redisClient.duplicate();
  const subClient = await redisClient.duplicate();
  if (!pubClient || !subClient) return false;

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
      // клиенты могли не успеть подключиться
    }
    return false;
  }
}

module.exports = { setupRedisAdapter };
