'use strict';

/**
 * presenceStore — unit-тесты fallback-режима (Redis в тестах отключён).
 */

const presenceStore = require('../src/realtime/presenceStore');
const redisClient = require('../src/cache/redisClient');

let now = 1_700_000_000_000;

beforeEach(() => {
  presenceStore.__reset();
  now = 1_700_000_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('presenceStore (in-memory fallback)', () => {
  test('register/update/unregister и summary', async () => {
    await presenceStore.register('s1', { userId: 7, username: 'Max', role: 'USER', raceId: 5 });
    await presenceStore.register('s2', { userId: null, username: 'Гость', raceId: 5 });

    let summary = await presenceStore.summary(5);
    expect(summary.connections).toBe(2);
    expect(summary.usersCount).toBe(1);
    expect(summary.users).toEqual([7]);
    expect(summary.guests).toBe(1);
    expect(summary.raceConnections).toBe(2);

    await presenceStore.update('s1', { raceId: null });
    summary = await presenceStore.summary(5);
    expect(summary.raceConnections).toBe(1);

    await presenceStore.unregister('s2');
    summary = await presenceStore.summary(5);
    expect(summary.connections).toBe(1);
    expect(summary.guests).toBe(0);
  });

  test('summary без raceId не считает raceConnections', async () => {
    await presenceStore.register('s1', { userId: 1 });
    const summary = await presenceStore.summary();
    expect(summary.connections).toBe(1);
    expect(summary.raceConnections).toBeUndefined();
  });

  test('устаревшие записи (старше 60 с) игнорируются', async () => {
    await presenceStore.register('old', { userId: 1 });
    now += 61_000;
    await presenceStore.register('fresh', { userId: 2 });

    const summary = await presenceStore.summary();
    expect(summary.connections).toBe(1);
    expect(summary.users).toEqual([2]);
  });

  test('heartbeat продлевает жизнь записи', async () => {
    await presenceStore.register('s1', { userId: 1 });
    now += 50_000;
    await presenceStore.heartbeat('s1');
    now += 30_000;

    const summary = await presenceStore.summary();
    expect(summary.connections).toBe(1);
  });

  test('запоздавший update после unregister не воскрешает запись', async () => {
    await presenceStore.register('s1', { userId: 1, raceId: '2026-5' });
    await presenceStore.unregister('s1');

    // эмулирует heartbeat/leave, пришедший после disconnect
    await presenceStore.update('s1', { raceId: null });

    const summary = await presenceStore.summary();
    expect(summary.connections).toBe(0);
    expect(summary.guests).toBe(0);
    expect(summary.users).toEqual([]);
  });
});

describe('presenceStore с Redis (операции сериализованы по сокету)', () => {
  let hash;

  function fakeClient() {
    hash = new Map();
    return {
      hSet: jest.fn(async (_key, field, raw) => {
        // небольшая задержка делает гонку update/unregister воспроизводимой
        await Promise.resolve();
        hash.set(field, raw);
        return 1;
      }),
      hGet: jest.fn(async (_key, field) => hash.get(field) ?? null),
      hDel: jest.fn(async (_key, field) => {
        hash.delete(field);
        return 1;
      }),
      hGetAll: jest.fn(async () => Object.fromEntries(hash)),
    };
  }

  test('update и unregister выполняются по порядку, запись не остаётся', async () => {
    const client = fakeClient();
    jest.spyOn(redisClient, 'getClient').mockResolvedValue(client);

    await presenceStore.register('s1', { userId: 1, raceId: '2026-5' });
    expect(hash.has('s1')).toBe(true);

    const update = presenceStore.update('s1', { raceId: null });
    const remove = presenceStore.unregister('s1');
    await Promise.all([update, remove]);

    expect(hash.has('s1')).toBe(false);
    const summary = await presenceStore.summary();
    expect(summary.connections).toBe(0);
  });

  test('summary читает актуальный состав из Redis', async () => {
    const client = fakeClient();
    jest.spyOn(redisClient, 'getClient').mockResolvedValue(client);

    await presenceStore.register('s1', { userId: 7, username: 'Max', raceId: '2026-5' });
    await presenceStore.register('s2', { userId: null, username: 'Гость', raceId: '2026-5' });

    const summary = await presenceStore.summary('2026-5');
    expect(summary.connections).toBe(2);
    expect(summary.users).toEqual([7]);
    expect(summary.guests).toBe(1);
    expect(summary.raceConnections).toBe(2);
  });
});
