'use strict';

/**
 * presenceStore — unit-тесты fallback-режима (Redis в тестах отключён).
 */

const presenceStore = require('../src/realtime/presenceStore');

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
});
