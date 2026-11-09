'use strict';

/**
 * cacheService — ветки с реальным (fake) Redis-клиентом и fallback при ошибках.
 */

jest.mock('../src/cache/redisClient', () => ({
  getClient: jest.fn(),
  ping: jest.fn(),
  isEnabled: jest.fn(() => true),
}));

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const redisClient = require('../src/cache/redisClient');
const cacheService = require('../src/cache/cacheService');

function fakeClient(overrides = {}) {
  const store = new Map();
  return {
    get: jest.fn(async (key) => store.get(key) ?? null),
    set: jest.fn(async (key, raw) => {
      store.set(key, raw);
      return 'OK';
    }),
    del: jest.fn(async (key) => {
      store.delete(key);
      return 1;
    }),
    scanIterator: async function* scanIterator() {
      yield* ['f1:api:/one', 'f1:api:/two'];
    },
    unlink: jest.fn(async () => 1),
    store,
    ...overrides,
  };
}

beforeEach(() => {
  cacheService.__reset();
  jest.clearAllMocks();
  redisClient.isEnabled.mockReturnValue(true);
});

describe('cacheService с Redis', () => {
  test('set/get сериализуют значение в Redis', async () => {
    const client = fakeClient();
    redisClient.getClient.mockResolvedValue(client);

    await expect(cacheService.set('f1:test:redis', { ok: true }, 5000)).resolves.toBe(true);
    expect(client.set).toHaveBeenCalledWith('f1:test:redis', JSON.stringify({ ok: true }), { PX: 5000 });

    await expect(cacheService.get('f1:test:redis')).resolves.toEqual({ ok: true });
  });

  test('битый JSON удаляется из Redis', async () => {
    const client = fakeClient({ get: jest.fn(async () => 'not-json') });
    redisClient.getClient.mockResolvedValue(client);

    await expect(cacheService.get('f1:test:broken')).resolves.toBeNull();
    expect(client.del).toHaveBeenCalledWith('f1:test:broken');
  });

  test('fallback в память при ошибке set и get', async () => {
    const client = fakeClient({
      set: jest.fn(async () => {
        throw new Error('redis write failed');
      }),
      get: jest.fn(async () => {
        throw new Error('redis read failed');
      }),
    });
    redisClient.getClient.mockResolvedValue(client);

    await expect(cacheService.set('f1:test:fallback', 42, 5000)).resolves.toBe(false);
    await expect(cacheService.get('f1:test:fallback')).resolves.toBe(42);
  });

  test('delByPrefix удаляет ключи через scanIterator/unlink', async () => {
    const client = fakeClient();
    redisClient.getClient.mockResolvedValue(client);

    await cacheService.delByPrefix('f1:api:');

    expect(client.unlink).toHaveBeenCalledWith(['f1:api:/one', 'f1:api:/two']);
  });

  test('getOrSet не кэширует undefined и повторно вызывает loader', async () => {
    redisClient.getClient.mockResolvedValue(null);
    const loader = jest.fn(async () => undefined);

    const first = await cacheService.getOrSet('f1:test:undefined', 5000, loader);
    const second = await cacheService.getOrSet('f1:test:undefined', 5000, loader);

    expect(first).toEqual({ value: undefined, cached: false });
    expect(second).toEqual({ value: undefined, cached: false });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  test('ping и isEnabled делегируют в redisClient', async () => {
    redisClient.ping.mockResolvedValue(true);

    await expect(cacheService.ping()).resolves.toBe(true);
    expect(cacheService.isEnabled()).toBe(true);
  });
});
