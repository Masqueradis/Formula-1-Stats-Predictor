'use strict';

/**
 * cacheService — unit-тесты fallback-режима (Redis в тестах отключён).
 */

const cacheService = require('../src/cache/cacheService');
const keys = require('../src/cache/keys');

let now = 1_700_000_000_000;

beforeEach(() => {
  cacheService.__reset();
  now = 1_700_000_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('cacheService (in-memory fallback)', () => {
  test('в тестах Redis отключён', async () => {
    expect(cacheService.isEnabled()).toBe(false);
    expect(await cacheService.ping()).toBe(false);
  });

  test('set/get сохраняет JSON-значение', async () => {
    await cacheService.set(keys.newsPool(), { items: [{ title: 'Race' }] }, 5000);
    await expect(cacheService.get(keys.newsPool())).resolves.toEqual({ items: [{ title: 'Race' }] });
  });

  test('TTL истекает и значение удаляется', async () => {
    await cacheService.set('f1:test:ttl', { ok: true }, 1000);
    now += 999;
    await expect(cacheService.get('f1:test:ttl')).resolves.toEqual({ ok: true });

    now += 2;
    await expect(cacheService.get('f1:test:ttl')).resolves.toBeNull();
  });

  test('getOrSet вызывает loader один раз и возвращает cached', async () => {
    const loader = jest.fn(async () => ({ value: 42 }));

    const first = await cacheService.getOrSet('f1:test:get-or-set', 5000, loader);
    const second = await cacheService.getOrSet('f1:test:get-or-set', 5000, loader);

    expect(first).toEqual({ value: { value: 42 }, cached: false });
    expect(second).toEqual({ value: { value: 42 }, cached: true });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  test('delByPrefix удаляет только совпадающие ключи', async () => {
    await cacheService.set('f1:api:/one', 1, 5000);
    await cacheService.set('f1:api:/two', 2, 5000);
    await cacheService.set('f1:news:pool', 3, 5000);

    await cacheService.delByPrefix(keys.prefixes.api);

    await expect(cacheService.get('f1:api:/one')).resolves.toBeNull();
    await expect(cacheService.get('f1:api:/two')).resolves.toBeNull();
    await expect(cacheService.get('f1:news:pool')).resolves.toBe(3);
  });

  test('del удаляет конкретный ключ', async () => {
    await cacheService.set('f1:test:del', 'x', 5000);
    await cacheService.del('f1:test:del');
    await expect(cacheService.get('f1:test:del')).resolves.toBeNull();
  });
});
