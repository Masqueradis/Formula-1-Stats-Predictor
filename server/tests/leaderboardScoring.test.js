'use strict';

const { scoreVote, RULES } = require('../src/services/leaderboardService');

const RESULTS = new Map([[1, 1], [2, 2], [3, 3], [4, 4]]);

describe('RULES', () => {
  test('точное место +3, топ-3 +1', () => {
    expect(RULES).toEqual({ exact: 3, podium: 1 });
  });
});

describe('scoreVote — точные совпадения', () => {
  test('все три места угаданы точно → 3+3+3 = 9', () => {
    const vote = { picks: [{ driverId: 1, position: 1 }, { driverId: 2, position: 2 }, { driverId: 3, position: 3 }] };
    expect(scoreVote(vote, RESULTS)).toEqual({ score: 9, exactHits: 3, podiumHits: 0 });
  });

  test('одно точное место +3, ещё одно в ТОП-3 с другим местом +1 → 4', () => {
    const vote = { picks: [{ driverId: 1, position: 1 }, { driverId: 4, position: 2 }, { driverId: 2, position: 3 }] };
    expect(scoreVote(vote, RESULTS)).toEqual({ score: 4, exactHits: 1, podiumHits: 1 });
  });
});

describe('scoreVote — попадание в ТОП-3 с неверным местом', () => {
  test('предсказан 2-м, финишировал 3-м → +1 (оба в ТОП-3)', () => {
    const vote = { picks: [{ driverId: 3, position: 2 }] };
    expect(scoreVote(vote, RESULTS)).toEqual({ score: 1, exactHits: 0, podiumHits: 1 });
  });

  test('пилот в ТОП-3 фактически, но предсказан не на ТОП-3 (место 5) → 0', () => {
    const vote = { picks: [{ driverId: 1, position: 5 }] };
    expect(scoreVote(vote, RESULTS)).toEqual({ score: 0, exactHits: 0, podiumHits: 0 });
  });

  test('предсказан на ТОП-3, финиш вне ТОП-3 → 0', () => {
    const vote = { picks: [{ driverId: 4, position: 1 }] };
    expect(scoreVote(vote, RESULTS)).toEqual({ score: 0, exactHits: 0, podiumHits: 0 });
  });
});

describe('scoreVote — пустые/неполные данные', () => {
  test('нет picks → 0', () => {
    expect(scoreVote({ picks: [] }, RESULTS).score).toBe(0);
    expect(scoreVote({}, RESULTS).score).toBe(0);
  });

  test('пилот не финишировал (нет результата) → 0', () => {
    const vote = { picks: [{ driverId: 999, position: 1 }] };
    expect(scoreVote(vote, RESULTS)).toEqual({ score: 0, exactHits: 0, podiumHits: 0 });
  });

  test('мусорная позиция результата (0/отрицательная) игнорируется', () => {
    const dirty = new Map([[1, 0], [2, 2]]);
    const vote = { picks: [{ driverId: 1, position: 1 }, { driverId: 2, position: 2 }] };
    expect(scoreVote(vote, dirty)).toEqual({ score: 3, exactHits: 1, podiumHits: 0 });
  });
});

describe('scoreVote — симметрия full и top3', () => {
  test('одинаковые picks → одинаковый балл независимо от kind', () => {
    const picks = [{ driverId: 1, position: 1 }, { driverId: 2, position: 3 }, { driverId: 3, position: 2 }];
    const full = scoreVote({ kind: 'full', picks }, RESULTS);
    const top3 = scoreVote({ kind: 'top3', picks }, RESULTS);
    expect(full).toEqual(top3);
    expect(full).toEqual({ score: 5, exactHits: 1, podiumHits: 2 });
  });
});
