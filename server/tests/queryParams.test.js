'use strict';

/**
 * Эпик-13 (BUG-20): защита query-параметров.
 */

const { cleanSearch, clampInt, cleanId, SEARCH_MAX_LENGTH } = require('../src/utils/queryParams');

describe('cleanSearch', () => {
  test('обрезает пробелы и пустую строку превращает в null', () => {
    expect(cleanSearch('  Verstappen  ')).toBe('Verstappen');
    expect(cleanSearch('   ')).toBeNull();
    expect(cleanSearch(undefined)).toBeNull();
    expect(cleanSearch(42)).toBeNull();
  });

  test('ограничивает длину поиска', () => {
    const long = 'a'.repeat(500);
    expect(cleanSearch(long)).toHaveLength(SEARCH_MAX_LENGTH);
    expect(cleanSearch(long, 20)).toHaveLength(20);
  });
});

describe('clampInt', () => {
  test('приводит limit к диапазону [1; 100]', () => {
    expect(clampInt('999999', { fallback: 50 })).toBe(100);
    expect(clampInt('-5', { fallback: 50 })).toBe(1);
    expect(clampInt('25', { fallback: 50 })).toBe(25);
  });

  test('нечисловое значение → fallback', () => {
    expect(clampInt('abc', { fallback: 50 })).toBe(50);
    expect(clampInt(undefined, { fallback: 50 })).toBe(50);
  });
});

describe('cleanId', () => {
  test('оставляет только положительные числа', () => {
    expect(cleanId('12')).toBe(12);
    expect(cleanId('0')).toBeNull();
    expect(cleanId('-3')).toBeNull();
    expect(cleanId('abc')).toBeNull();
    expect(cleanId(null)).toBeNull();
  });
});
