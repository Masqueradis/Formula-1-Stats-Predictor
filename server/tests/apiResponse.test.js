'use strict';

/**
 * Юнит-тесты `apiResponse` — единый формат ответов REST API (лаба 4).
 * Проверяем статус-коды и тело `{ success, data | error, pagination }`.
 */

const apiResponse = require('../src/utils/apiResponse');

/** Минималистичный мок express-`res` */
function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('apiResponse.success', () => {
  test('по умолчанию отдаёт 200 и { success: true, data }', () => {
    const res = mockRes();
    apiResponse.success(res, { id: 1 });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, data: { id: 1 } });
  });

  test('позволяет задать свой статус', () => {
    const res = mockRes();
    apiResponse.success(res, 'ok', 202);
    expect(res.statusCode).toBe(202);
    expect(res.body.success).toBe(true);
  });
});

describe('apiResponse.created', () => {
  test('всегда 201', () => {
    const res = mockRes();
    apiResponse.created(res, { id: 7 });
    expect(res.statusCode).toBe(201);
    expect(res.body.data).toEqual({ id: 7 });
  });
});

describe('apiResponse.error', () => {
  test('тело содержит success: false и сообщение', () => {
    const res = mockRes();
    apiResponse.error(res, 'Bad thing', 400);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'Bad thing' });
  });

  test('details добавляется только при наличии', () => {
    const res = mockRes();
    apiResponse.error(res, 'Nope', 422, { field: 'picks' });
    expect(res.body.details).toEqual({ field: 'picks' });
  });
});

describe('apiResponse.notFound', () => {
  test('404 и имя ресурса в сообщении', () => {
    const res = mockRes();
    apiResponse.notFound(res, 'Driver');
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Driver not found');
  });
});

describe('apiResponse.paginated', () => {
  test('считает страницы и отдаёт метаданные', () => {
    const res = mockRes();
    apiResponse.paginated(res, { rows: [{ id: 1 }], count: 21, page: 3, limit: 10 });
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual([{ id: 1 }]);
    expect(res.body.pagination).toEqual({ total: 21, page: 3, limit: 10, pages: 3 });
  });
});
