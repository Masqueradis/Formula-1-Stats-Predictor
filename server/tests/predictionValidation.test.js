'use strict';

/**
 * Юнит-тесты валидации прогнозов (predictionService) — чистые функции:
 * - normalizePicks: нормализация тела запроса { kind, picks } (эпик-06/09);
 * - validatePicks: сверка с составом документа гонки ('full' — перестановка 1..N,
 *   'top3' — ровно 3 пилота с местами 1-2-3, эпик-09 US-5);
 * - isVotingOpen: окно голосования (гонка scheduled и ещё не началась).
 */

const { normalizePicks, validatePicks, isVotingOpen } = require('../src/services/predictionService');

/** Документ гонки с 3 пилотами (минимальный срез, нужный validatePicks) */
const DOC = { entries: [{ driverId: 10 }, { driverId: 20 }, { driverId: 30 }] };

describe('normalizePicks', () => {
  test('kind по умолчанию full', () => {
    const { kind } = normalizePicks({ picks: [{ driverId: 1, position: 1 }] });
    expect(kind).toBe('full');
  });

  test('kind: top3 сохраняется', () => {
    const { kind } = normalizePicks({ kind: 'top3', picks: [] });
    expect(kind).toBe('top3');
  });

  test('строковые числа приводятся к integer', () => {
    const { picks } = normalizePicks({ picks: [{ driverId: '10', position: '2' }] });
    expect(picks).toEqual([{ driverId: 10, position: 2 }]);
  });

  test('отсутствие picks → 400', () => {
    expect(() => normalizePicks({})).toThrow(/picks must be an array/);
  });

  test('некорректный driverId → 400', () => {
    expect(() => normalizePicks({ picks: [{ driverId: -5, position: 1 }] })).toThrow(/Invalid driverId/);
    expect(() => normalizePicks({ picks: [{ driverId: 'abc', position: 1 }] })).toThrow(/Invalid driverId/);
  });

  test('position < 1 или дробная → 400', () => {
    expect(() => normalizePicks({ picks: [{ driverId: 1, position: 0 }] })).toThrow(/Invalid position/);
    expect(() => normalizePicks({ picks: [{ driverId: 1, position: 1.5 }] })).toThrow(/Invalid position/);
  });
});

describe('validatePicks — full (перестановка 1..N)', () => {
  const full = [
    { driverId: 10, position: 3 },
    { driverId: 20, position: 1 },
    { driverId: 30, position: 2 },
  ];

  test('корректная перестановка проходит', () => {
    expect(() => validatePicks(DOC, 'full', full)).not.toThrow();
  });

  test('дубль пилота → 400', () => {
    const dup = [full[0], full[0], full[2]];
    expect(() => validatePicks(DOC, 'full', dup)).toThrow(/Duplicate drivers/);
  });

  test('пилот не из состава гонки → 400', () => {
    const foreign = [{ driverId: 999, position: 1 }, full[1], full[2]];
    expect(() => validatePicks(DOC, 'full', foreign)).toThrow(/not in this race/);
  });

  test('не все пилоты → 422', () => {
    expect(() => validatePicks(DOC, 'full', full.slice(0, 2))).toThrow(/all 3 drivers/);
  });

  test('позиции не перестановка 1..N (дубль места) → 422', () => {
    const badPositions = [
      { driverId: 10, position: 1 },
      { driverId: 20, position: 1 },
      { driverId: 30, position: 2 },
    ];
    expect(() => validatePicks(DOC, 'full', badPositions)).toThrow(/unique permutation/);
  });

  test('позиция вне диапазона 1..N → 422', () => {
    const outOfRange = [
      { driverId: 10, position: 1 },
      { driverId: 20, position: 2 },
      { driverId: 30, position: 4 },
    ];
    expect(() => validatePicks(DOC, 'full', outOfRange)).toThrow(/unique permutation/);
  });
});

describe('validatePicks — top3 (личный прогноз US-5)', () => {
  const top3 = [
    { driverId: 20, position: 1 },
    { driverId: 30, position: 2 },
    { driverId: 10, position: 3 },
  ];

  test('ровно 3 пилота с местами 1-2-3 → ок', () => {
    expect(() => validatePicks(DOC, 'top3', top3)).not.toThrow();
  });

  test('не 3 пилота → 422', () => {
    expect(() => validatePicks(DOC, 'top3', top3.slice(0, 2))).toThrow(/exactly 3 drivers/);
  });

  test('места не 1-2-3 → 422', () => {
    const wrongPlaces = [
      { driverId: 20, position: 1 },
      { driverId: 30, position: 2 },
      { driverId: 10, position: 4 },
    ];
    expect(() => validatePicks(DOC, 'top3', wrongPlaces)).toThrow(/exactly 1, 2 and 3/);
  });

  test('дубль пилота → 400 (общая проверка)', () => {
    const dup = [top3[0], top3[0], top3[2]];
    expect(() => validatePicks(DOC, 'top3', dup)).toThrow(/Duplicate drivers/);
  });
});

describe('isVotingOpen (окно голосования)', () => {
  const dayAfterTomorrow = new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);

  test('scheduled и дата в будущем → открыто', () => {
    expect(isVotingOpen({ status: 'scheduled', date: dayAfterTomorrow })).toBe(true);
  });

  test('scheduled без даты → открыто', () => {
    expect(isVotingOpen({ status: 'scheduled', date: '' })).toBe(true);
  });

  test('дата миновала (гонка началась) → закрыто', () => {
    expect(isVotingOpen({ status: 'scheduled', date: yesterday })).toBe(false);
  });

  test('finished/cancelled → закрыто независимо от даты', () => {
    expect(isVotingOpen({ status: 'finished', date: dayAfterTomorrow })).toBe(false);
    expect(isVotingOpen({ status: 'cancelled', date: dayAfterTomorrow })).toBe(false);
  });
});
