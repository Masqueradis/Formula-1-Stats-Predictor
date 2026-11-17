'use strict';

const { toRussianNationality, NATIONALITY_RU } = require('../src/utils/nationalities');

describe('toRussianNationality', () => {
  test('переводит известные национальности пилотов и команд', () => {
    expect(toRussianNationality('British')).toBe('Великобритания');
    expect(toRussianNationality('Dutch')).toBe('Нидерланды');
    expect(toRussianNationality('Monegasque')).toBe('Монако');
    expect(toRussianNationality('German')).toBe('Германия');
  });

  test('регистр и лишние пробелы не важны', () => {
    expect(toRussianNationality('  british ')).toBe('Великобритания');
    expect(toRussianNationality('NEW ZEALANDER')).toBe('Новая Зеландия');
  });

  test('неизвестное значение возвращается без изменений (данные не теряются)', () => {
    expect(toRussianNationality('Martian')).toBe('Martian');
  });

  test('пустые и нестроковые значения → null', () => {
    expect(toRussianNationality('')).toBeNull();
    expect(toRussianNationality('   ')).toBeNull();
    expect(toRussianNationality(null)).toBeNull();
    expect(toRussianNationality(42)).toBeNull();
  });

  test('справочник покрывает национальности текущих команд и пилотов', () => {
    for (const value of ['British', 'German', 'Austrian', 'Italian', 'American', 'French', 'Dutch', 'Spanish', 'Mexican', 'Thai']) {
      expect(NATIONALITY_RU[value]).toBeTruthy();
    }
  });
});
