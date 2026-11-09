'use strict';

/**
 * redisAdapter — защита от unhandledRejection из fire-and-forget publish/subscribe.
 * При обрыве Redis @socket.io/redis-adapter не await'ит промисы node-redis;
 * обёртка должна гасить ClientOfflineError и не ронять процесс.
 */

const { EventEmitter } = require('events');

jest.mock('../src/cache/redisClient', () => ({
  isEnabled: jest.fn(() => true),
  connect: jest.fn(),
  duplicate: jest.fn(),
}));

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const redisClient = require('../src/cache/redisClient');
const logger = require('../src/utils/logger');
const { setupRedisAdapter } = require('../src/realtime/redisAdapter');

function fakeClient({ publish } = {}) {
  const client = new EventEmitter();
  client.connect = jest.fn(async () => {});
  client.disconnect = jest.fn();
  client.publish = publish || jest.fn(async () => 1);
  client.subscribe = jest.fn(async () => {});
  client.pSubscribe = jest.fn(async () => {});
  client.unsubscribe = jest.fn(async () => {});
  client.pUnsubscribe = jest.fn(async () => {});
  return client;
}

beforeEach(() => {
  jest.clearAllMocks();
  redisClient.isEnabled.mockReturnValue(true);
});

describe('setupRedisAdapter', () => {
  test('при выключенном Redis адаптер не включается', async () => {
    redisClient.isEnabled.mockReturnValue(false);
    const io = { adapter: jest.fn() };

    await expect(setupRedisAdapter(io)).resolves.toBe(false);
    expect(redisClient.connect).not.toHaveBeenCalled();
    expect(io.adapter).not.toHaveBeenCalled();
  });

  test('отклонённый publish не становится unhandledRejection', async () => {
    const offlineError = Object.assign(new Error('The client is closed'), {
      name: 'ClientOfflineError',
    });
    const pub = fakeClient({ publish: jest.fn(() => Promise.reject(offlineError)) });
    const sub = fakeClient();
    redisClient.connect.mockResolvedValue({});
    redisClient.duplicate.mockResolvedValueOnce(pub).mockResolvedValueOnce(sub);

    const io = { adapter: jest.fn() };
    await expect(setupRedisAdapter(io)).resolves.toBe(true);

    await expect(pub.publish('socket.io#/#', 'payload')).resolves.toBe(0);
    expect(logger.warn).toHaveBeenCalledWith(
      'realtime.redis_publish_failed',
      expect.objectContaining({ reason: 'The client is closed' }),
    );
  });

  test('синхронный throw из publish также гасится', async () => {
    const pub = fakeClient({
      publish: jest.fn(() => {
        throw new Error('publish exploded');
      }),
    });
    const sub = fakeClient();
    redisClient.connect.mockResolvedValue({});
    redisClient.duplicate.mockResolvedValueOnce(pub).mockResolvedValueOnce(sub);

    await expect(setupRedisAdapter({ adapter: jest.fn() })).resolves.toBe(true);
    await expect(pub.publish('channel', 'payload')).resolves.toBe(0);
  });

  test('отклонённый subscribe не всплывает наружу', async () => {
    const pub = fakeClient();
    const sub = fakeClient();
    sub.subscribe.mockImplementation(() => Promise.reject(new Error('subscribe failed')));
    redisClient.connect.mockResolvedValue({});
    redisClient.duplicate.mockResolvedValueOnce(pub).mockResolvedValueOnce(sub);

    await expect(setupRedisAdapter({ adapter: jest.fn() })).resolves.toBe(true);
    await expect(sub.subscribe(['a', 'b'])).resolves.toBe(0);
  });
});
