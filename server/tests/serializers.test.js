'use strict';

const { sanitizeDriver } = require('../src/utils/serializers');

function driver(overrides = {}) {
  return {
    id: 1,
    firstName: 'Valtteri',
    lastName: 'Bottas',
    abbreviation: 'BOT',
    number: 77,
    ...overrides,
  };
}

describe('sanitizeDriver — текущая команда (BUG-07)', () => {
  test('выбирает команду с максимальным сезоном, а не последнюю по id', () => {
    const record = driver({
      seasonTeams: [
        { id: 900, season: 2024, isReserve: false, team: { id: 4, name: 'Cadillac', color: '#111' } },
        { id: 10, season: 2026, isReserve: false, team: { id: 4, name: 'Cadillac', color: '#111' } },
        { id: 5, season: 2025, isReserve: false, team: { id: 1, name: 'Alfa Romeo', color: '#222' } },
      ],
    });

    const result = sanitizeDriver(record, { currentSeason: 2026 });

    expect(result.team).toEqual({ id: 4, name: 'Cadillac', color: '#111' });
    expect(result.teamSeason).toBe(2026);
    expect(result.isCurrentSeason).toBe(true);
    expect(result.seasonTeams).toBeUndefined();
  });

  test('при равном сезоне боевой пилот важнее резервиста', () => {
    const record = driver({
      seasonTeams: [
        { id: 1, season: 2026, isReserve: true, team: { id: 7, name: 'Reserve Team', color: '#333' } },
        { id: 2, season: 2026, isReserve: false, team: { id: 4, name: 'Cadillac', color: '#111' } },
      ],
    });

    const result = sanitizeDriver(record, { currentSeason: 2026 });

    expect(result.team.name).toBe('Cadillac');
  });

  test('при равенстве сезона и статуса — меньший id', () => {
    const record = driver({
      seasonTeams: [
        { id: 8, season: 2026, isReserve: false, team: { id: 2, name: 'Later', color: '#222' } },
        { id: 3, season: 2026, isReserve: false, team: { id: 1, name: 'Earlier', color: '#111' } },
      ],
    });

    expect(sanitizeDriver(record, { currentSeason: 2026 }).team.name).toBe('Earlier');
  });

  test('пилот вне текущего сезона получает isCurrentSeason=false', () => {
    const record = driver({
      lastName: 'Lawson',
      seasonTeams: [
        { id: 1, season: 2025, isReserve: false, team: { id: 1, name: 'Racing Bulls', color: '#6692ff' } },
      ],
    });

    const result = sanitizeDriver(record, { currentSeason: 2026 });

    expect(result.teamSeason).toBe(2025);
    expect(result.isCurrentSeason).toBe(false);
  });

  test('без seasonTeams команда пустая, признак сезона не определён', () => {
    const result = sanitizeDriver(driver(), { currentSeason: 2026 });

    expect(result.team).toBeNull();
    expect(result.teamSeason).toBeNull();
    expect(result.isCurrentSeason).toBeNull();
  });

  test('seasonTeams как одиночный объект (include без массива) поддерживается', () => {
    const record = driver({
      seasonTeams: { id: 3, season: 2026, isReserve: false, team: { id: 5, name: 'Ferrari', color: '#dc0000' } },
    });

    expect(sanitizeDriver(record, { currentSeason: 2026 }).team.name).toBe('Ferrari');
  });

  test('nationalityRu добавляется без изменения исходной национальности (BUG-18)', () => {
    const result = sanitizeDriver(driver({ nationality: 'British' }), { currentSeason: 2026 });

    expect(result.nationality).toBe('British');
    expect(result.nationalityRu).toBe('Великобритания');
  });
});
