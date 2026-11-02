'use strict';

/**
 * Юнит-тесты алгоритма Softmax (US-4, Phase 4) — чистые функции probabilityService.
 * Формула: S_i = w1·P_qual + w2·F_driver + w3·F_team + w4·H_track, P(i) = e^{S_i}/Σe^{S_j}.
 */

const {
  softmax,
  positionScore,
  average,
  blendAverage,
  formSourceFor,
  WEIGHTS,
} = require('../src/services/probabilityService');

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

describe('blendAverage (прошлый сезон в формуле, эпик-10)', () => {
  test('нет данных ни там, ни там → нейтральный приор', () => {
    expect(blendAverage(null, null, 1)).toEqual({ value: 0.5, source: 'neutral' });
  });

  test('только текущий сезон → source=current', () => {
    expect(blendAverage(0.8, null, 0.4)).toEqual({ value: 0.8, source: 'current' });
  });

  test('только прошлый сезон → source=previous', () => {
    expect(blendAverage(null, 0.4, 0)).toEqual({ value: 0.4, source: 'previous' });
  });

  test('вес 1 → прошлый сезон не влияет', () => {
    expect(blendAverage(0.8, 0.2, 1)).toEqual({ value: 0.8, source: 'current' });
  });

  test('вес 0 → только прошлый сезон', () => {
    expect(blendAverage(0.8, 0.2, 0)).toEqual({ value: 0.2, source: 'previous' });
  });

  test('промежуточный вес → взвешенное среднее', () => {
    const result = blendAverage(0.8, 0.2, 0.25);
    expect(result.value).toBeCloseTo(0.35, 10);
    expect(result.source).toBe('blended');
  });

  test('вес вне [0;1] обрезается', () => {
    expect(blendAverage(0.9, 0.1, 5).value).toBeCloseTo(0.9, 10);
    expect(blendAverage(0.9, 0.1, -3).value).toBeCloseTo(0.1, 10);
  });
});

describe('formSourceFor', () => {
  test('есть оба сезона → blended', () => {
    expect(formSourceFor(3, 5)).toBe('blended');
  });

  test('только текущий → current', () => {
    expect(formSourceFor(5, 0)).toBe('current');
  });

  test('только прошлый → previous', () => {
    expect(formSourceFor(0, 5)).toBe('previous');
  });

  test('нет данных → neutral', () => {
    expect(formSourceFor(0, 0)).toBe('neutral');
  });
});
