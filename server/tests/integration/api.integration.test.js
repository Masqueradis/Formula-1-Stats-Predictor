'use strict';

/**
 * Интеграционные тесты REST API через Supertest против запущенного backend
 * (http://localhost:3000, стек поднят: `docker compose up -d` или `make dev`).
 *
 * Прогоняются только при INTEGRATION=1 — на стенде без БД пропускаются:
 *   INTEGRATION=1 npm run test:integration
 *
 * Порядок: health → публичные GET → auth register/login → свойства API.
 * Побочные эффекты минимальны: регистрация тестового юзера помечается
 * isVerified=false, письма уходят в MailHog (не в реальную почту).
 */

const request = require('supertest');

const BASE = process.env.TEST_API_URL || 'http://localhost:3000';
const RUN = process.env.INTEGRATION === '1';

const EMAIL = `jest-it-${Date.now()}@test.local`;
const USERNAME = `jest_it_${Date.now().toString(36)}`;
const PASSWORD = 'JestIntegration1!';

jest.setTimeout(30000);

const maybe = RUN ? describe : describe.skip;

maybe('API (integration)', () => {
  let token = null;

  test('GET /api/health → обе БД up', async () => {
    const res = await request(BASE).get('/api/health').expect(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.databases.postgres).toBe('up');
    expect(res.body.data.databases.mongo).toBe('up');
  });

  test('GET /api/races → список гонок с season/round', async () => {
    const res = await request(BASE).get('/api/races').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('season');
    expect(res.body.data[0]).toHaveProperty('round');
  });

  test('GET /api/races?season=current → только последний сезон', async () => {
    const res = await request(BASE).get('/api/races?season=current').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    const seasons = new Set(res.body.data.map((race) => race.season));
    expect(seasons.size).toBe(1);
  });

  test('GET /api/history/seasons → непустой список сезонов', async () => {
    const res = await request(BASE).get('/api/history/seasons').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toEqual(expect.objectContaining({
      season: expect.any(Number),
      races: expect.any(Number),
    }));
  });

  test('GET /api/history/races + /races/:id → сезон, подиум и полная классификация', async () => {
    const seasons = await request(BASE).get('/api/history/seasons').expect(200);
    const season = seasons.body.data[0].season;

    const list = await request(BASE).get(`/api/history/races?season=${season}`).expect(200);
    expect(list.body.data.season).toBe(season);
    expect(Array.isArray(list.body.data.races)).toBe(true);
    expect(list.body.data.races.length).toBeGreaterThan(0);

    const card = list.body.data.races[0];
    expect(card).toHaveProperty('podium');
    const detail = await request(BASE).get(`/api/history/races/${card.id}`).expect(200);
    expect(detail.body.data.race.id).toBe(card.id);
    expect(Array.isArray(detail.body.data.results.race)).toBe(true);
    expect(detail.body.data.results.race.length).toBeGreaterThan(0);
    expect(detail.body.data.results.race[0]).toEqual(expect.objectContaining({
      positionText: expect.any(String),
      driver: expect.objectContaining({ id: expect.any(Number) }),
    }));
  });

  test('GET /api/standings?season=<исторический> → сезон в ответе', async () => {
    const seasons = await request(BASE).get('/api/history/seasons').expect(200);
    const season = seasons.body.data[0].season;
    const res = await request(BASE).get(`/api/standings?season=${season}`).expect(200);
    expect(res.body.data.season).toBe(season);
    expect(Array.isArray(res.body.data.standings)).toBe(true);
  });

  test('GET /api/drivers → список пилотов с аббревиатурой', async () => {
    const res = await request(BASE).get('/api/drivers').expect(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('abbreviation');
  });

  test('GET /api/predictions/next → документ ближайшей гонки или 404', async () => {
    const res = await request(BASE).get('/api/predictions/next');
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.data).toHaveProperty('raceId');
      expect(res.body.data).toHaveProperty('votingOpen');
    }
  });

  test('GET /api/leaderboard → { rules, total, users }', async () => {
    const res = await request(BASE).get('/api/leaderboard').expect(200);
    expect(res.body.data.rules).toEqual({ exact: 3, podium: 1 });
    expect(typeof res.body.data.total).toBe('number');
    expect(Array.isArray(res.body.data.users)).toBe(true);
  });

  test('POST /api/auth/register → 201, без подтверждения email вход закрыт', async () => {
    const res = await request(BASE)
      .post('/api/auth/register')
      .send({ username: USERNAME, email: EMAIL, password: PASSWORD })
      .expect(201);

    const login = await request(BASE)
      .post('/api/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(403);
    expect(login.body.error).toMatch(/not verified/i);
  });

  test('неверный пароль на подтверждённом сид-пользователе → 401/403, токен не выдаётся', async () => {
    const res = await request(BASE)
      .post('/api/auth/login')
      .send({ email: 'admin@f1stats.test', password: 'definitely-wrong' });
    expect([401, 403]).toContain(res.status);
    expect(res.body.data?.token).toBeUndefined();
  });

  test('POST /api/predictions/race/<id>/votes без токена → 401', async () => {
    const res = await request(BASE)
      .post('/api/predictions/race/2026-18/votes')
      .send({ kind: 'top3', picks: [] });
    expect([401, 403]).toContain(res.status);
  });

  test('PUT защищённого эндпоинта с битым токеном → 401/403, не 500', async () => {
    // PUT /votes/:userId — authenticate, до body-валидации: токен должен отклониться
    const res = await request(BASE)
      .put('/api/predictions/race/2026-18/votes/1')
      .set('Authorization', 'Bearer invalid-token')
      .send({ kind: 'top3', picks: [] });
    expect([401, 403]).toContain(res.status);
  });
});
