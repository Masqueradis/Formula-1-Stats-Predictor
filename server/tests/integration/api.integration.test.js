'use strict';

const request = require('supertest');

function normalizeBaseUrl(raw) {
  const trimmed = String(raw || '').trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
}

const BASE = normalizeBaseUrl(process.env.TEST_API_URL || 'http://localhost:3000');
const RUN = process.env.INTEGRATION === '1';

const EMAIL = `jest-it-${Date.now()}@test.local`;
const USERNAME = `jest_it_${Date.now().toString(36)}`;
const PASSWORD = 'JestIntegration1!';

jest.setTimeout(30000);

const maybe = RUN ? describe : describe.skip;

maybe('API (integration)', () => {
  let token = null;

  async function loginAsAdmin() {
    const res = await request(BASE)
      .post('/api/auth/login')
      .send({ email: 'admin@f1stats.test', password: 'admin123' });
    return res.status === 200 ? res.body.data.token : null;
  }

  afterAll(async () => {
    try {
      const adminToken = await loginAsAdmin();
      if (!adminToken) return;

      const list = await request(BASE)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);
      if (list.status !== 200 || !Array.isArray(list.body.data)) return;

      const stale = list.body.data.filter((u) => /^jest-it-.*@test\.local$/.test(u.email || ''));
      for (const user of stale) {
        await request(BASE)
          .delete(`/api/users/${user.id}`)
          .set('Authorization', `Bearer ${adminToken}`);
      }
    } catch (err) {
      console.warn(`[integration] user cleanup skipped: ${err.message}`);
    }
  });

  test('GET /api/health → обе БД up', async () => {
    const res = await request(BASE).get('/api/health').expect(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.databases.postgres).toBe('up');
    expect(res.body.data.databases.mongo).toBe('up');
  });

  test('GET /api/races?season=current → только текущий сезон', async () => {
    const res = await request(BASE).get('/api/races?season=current').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    const seasons = new Set(res.body.data.map((r) => r.season));
    expect(seasons.size).toBe(1);
    expect(res.body.data[0]).toHaveProperty('round');
  });

  test('GET /api/races?season=1900 → 400 «Некорректный сезон»', async () => {
    const res = await request(BASE).get('/api/races?season=1900').expect(400);
    expect(res.body.error).toMatch(/Некорректный сезон/);
  });

  test('GET /api/history/seasons → сезоны по убыванию с числом гонок', async () => {
    const res = await request(BASE).get('/api/history/seasons').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('season');
    expect(res.body.data[0]).toHaveProperty('races');
    const seasons = res.body.data.map((row) => row.season);
    expect([...seasons].sort((a, b) => b - a)).toEqual(seasons);
  });

  test('GET /api/history/races?season=2005 → карточки с подиумом', async () => {
    const res = await request(BASE).get('/api/history/races?season=2005').expect(200);
    expect(res.body.data.season).toBe(2005);
    expect(Array.isArray(res.body.data.races)).toBe(true);
    expect(res.body.data.races.length).toBeGreaterThan(0);
    expect(res.body.data.races[0]).toHaveProperty('podium');
  });

  test('GET /api/history/races/:id → полная классификация', async () => {
    const list = await request(BASE).get('/api/history/races?season=2005').expect(200);
    const raceId = list.body.data.races[0].id;
    const res = await request(BASE).get(`/api/history/races/${raceId}`).expect(200);
    expect(res.body.data.race.id).toBe(raceId);
    expect(Array.isArray(res.body.data.results.race)).toBe(true);
    expect(res.body.data.results.race.length).toBeGreaterThan(0);
    expect(res.body.data.results.race[0]).toHaveProperty('positionText');
    expect(res.body.data.results.race[0]).toHaveProperty('status');
  });

  test('GET /api/standings?season=2005 → исторические зачёты', async () => {
    const drivers = await request(BASE).get('/api/standings?season=2005&type=drivers').expect(200);
    expect(drivers.body.data.season).toBe(2005);
    expect(drivers.body.data.standings.length).toBeGreaterThan(0);
    const constructors = await request(BASE).get('/api/standings?season=2005&type=constructors').expect(200);
    expect(constructors.body.data.season).toBe(2005);
    expect(constructors.body.data.standings.length).toBeGreaterThan(0);
  });

  test('GET /api/race-results?season=1900 → 400', async () => {
    const res = await request(BASE).get('/api/race-results?season=1900').expect(400);
    expect(res.body.error).toMatch(/Некорректный сезон/);
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
    expect(login.body.error).toMatch(/не подтверждён/i);
  });

  test('GET /api/users не отдаёт passwordHash и verificationToken', async () => {
    const adminToken = await loginAsAdmin();
    expect(adminToken).toBeTruthy();

    const res = await request(BASE)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const payload = JSON.stringify(res.body);

    expect(payload).not.toContain('passwordHash');
    expect(payload).not.toContain('verificationToken');
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
    const res = await request(BASE)
      .put('/api/predictions/race/2026-18/votes/1')
      .set('Authorization', 'Bearer invalid-token')
      .send({ kind: 'top3', picks: [] });
    expect([401, 403]).toContain(res.status);
  });
});
