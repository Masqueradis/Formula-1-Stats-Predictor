'use strict';

/**
 * Юнит-тесты алгоритма Softmax (US-4, Phase 4) — чистые функции probabilityService.
 * Формула: S_i = w1·P_qual + w2·F_driver + w3·F_team + w4·H_track, P(i) = e^{S_i}/Σe^{S_j}.
 */

const { softmax, positionScore, average, WEIGHTS } = require('../src/services/probabilityService');

describe('WEIGHTS (веса формулы)', () => {
  test('сумма весов равна 1', () => {
    const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  test('веса заморожены (Object.freeze)', () => {
    expect(Object.isFrozen(WEIGHTS)).toBe(true);
  });
});

describe('softmax', () => {
  test('вероятности в процентах суммируются в ~100', () => {
    const probs = softmax([1, 2, 3]);
    expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
  });

  test('больший score → большая вероятность (монотонность)', () => {
    const probs = softmax([0.5, 0.6, 0.55]);
    expect(probs[1]).toBeGreaterThan(probs[2]);
    expect(probs[2]).toBeGreaterThan(probs[0]);
  });

  test('одинаковые score → равные вероятности', () => {
    const probs = softmax([2, 2, 2, 2]);
    probs.forEach((p) => expect(p).toBeCloseTo(25, 6));
  });

  test('защита от переполнения: большие score не дают NaN', () => {
    const probs = softmax([1000, 1001, 999]);
    expect(probs.every(Number.isFinite)).toBe(true);
    expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
  });

  test('все вероятности в диапазоне (0; 100)', () => {
    const probs = softmax([0.1, 0.9, 0.4, 0.7]);
    probs.forEach((p) => {
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(100);
    });
  });
});

describe('positionScore (позиция → оценка [0; 1])', () => {
  test('1-е место → 1.0', () => {
    expect(positionScore(1)).toBe(1);
  });

  test('21-е место и дальше → 0.0 (обрезка шкалы 20)', () => {
    expect(positionScore(21)).toBe(0);
    expect(positionScore(50)).toBe(0);
  });

  test('середина шкалы: 11-е место → 0.5', () => {
    expect(positionScore(11)).toBeCloseTo(0.5, 10);
  });

  test('мусор и нулевые позиции → null', () => {
    expect(positionScore(0)).toBeNull();
    expect(positionScore(-3)).toBeNull();
    expect(positionScore('abc')).toBeNull();
    expect(positionScore(null)).toBeNull();
    expect(positionScore(undefined)).toBeNull();
  });
});

describe('average (нейтральный приор для пустых данных)', () => {
  test('пустой массив → 0.5 (нет данных ≠ 0 баллов)', () => {
    expect(average([])).toBe(0.5);
  });

  test('среднее арифметическое', () => {
    expect(average([1, 0.5])).toBeCloseTo(0.75, 10);
  });
});
