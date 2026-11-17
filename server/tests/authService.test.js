'use strict';

jest.mock('../src/repositories/userRepository');
jest.mock('../src/services/emailService', () => ({
  sendVerificationEmail: jest.fn(),
  sendWelcomeEmail: jest.fn(),
}));

const bcrypt = require('bcryptjs');
const userRepository = require('../src/repositories/userRepository');
const authService = require('../src/services/authService');
const { sendVerificationEmail, sendWelcomeEmail } = require('../src/services/emailService');
const { hashToken } = require('../src/utils/verificationToken');

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(bcrypt, 'compare');
  userRepository.findByEmail.mockResolvedValue(null);
  userRepository.findByUsername.mockResolvedValue(null);
  userRepository.create.mockImplementation(async (data) => ({ id: 42, ...data, update: jest.fn() }));
  sendVerificationEmail.mockResolvedValue({ ok: true });
  sendWelcomeEmail.mockResolvedValue({ ok: true });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('authService.login — русские ошибки', () => {
  test('неизвестный email → 401 «Неверный email или пароль»', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    const result = await authService.login({ email: 'nobody@test.local', password: 'whatever1' });

    expect(result).toEqual({ error: 'Неверный email или пароль', status: 401 });
  });

  test('неверный пароль → 401 без подсказки, существует ли email', async () => {
    userRepository.findByEmail.mockResolvedValue({
      id: 1,
      email: 'maxfan@f1stats.test',
      isVerified: true,
      passwordHash: '$2b$10$hash',
    });
    bcrypt.compare.mockResolvedValue(false);

    const result = await authService.login({ email: 'maxfan@f1stats.test', password: 'wrong' });

    expect(result).toEqual({ error: 'Неверный email или пароль', status: 401 });
  });

  test('неподтверждённый email → 403 с просьбой проверить почту', async () => {
    userRepository.findByEmail.mockResolvedValue({
      id: 2,
      email: 'new@test.local',
      isVerified: false,
    });

    const result = await authService.login({ email: 'new@test.local', password: 'whatever1' });

    expect(result).toEqual({
      error: 'Email не подтверждён. Проверьте почту.',
      status: 403,
    });
  });

  test('пустые поля → 400', async () => {
    const result = await authService.login({ email: '', password: '' });
    expect(result).toEqual({ error: 'Укажите email и пароль', status: 400 });
  });
});

describe('authService.register — русские ошибки', () => {
  test('короткий пароль → 400', async () => {
    const result = await authService.register({
      username: 'fan',
      email: 'fan@test.local',
      password: '123',
    });

    expect(result).toEqual({
      error: 'Пароль должен содержать минимум 6 символов',
      status: 400,
    });
  });

  test('занятый email → 409', async () => {
    userRepository.findByEmail.mockResolvedValue({ id: 1 });

    const result = await authService.register({
      username: 'fan',
      email: 'fan@test.local',
      password: 'secret1',
    });

    expect(result).toEqual({ error: 'Этот email уже зарегистрирован', status: 409 });
  });

  test('занятый username → 409', async () => {
    userRepository.findByUsername.mockResolvedValue({ id: 1 });

    const result = await authService.register({
      username: 'fan',
      email: 'new@test.local',
      password: 'secret1',
    });

    expect(result).toEqual({ error: 'Это имя пользователя уже занято', status: 409 });
  });
});

describe('authService — подтверждение email (эпик-12)', () => {
  test('register хранит хеш токена и TTL 24 ч, в письмо уходит «сырой» токен', async () => {
    const result = await authService.register({
      username: 'fan',
      email: ' Fan@Test.Local ',
      password: 'secret1',
    });

    expect(result.status).toBe(201);
    expect(result.data.emailDelivered).toBe(true);
    const created = userRepository.create.mock.calls[0][0];
    const rawToken = sendVerificationEmail.mock.calls[0][1];

    expect(created.email).toBe('fan@test.local');
    expect(created.verificationToken).toMatch(/^[a-f0-9]{64}$/);
    expect(created.verificationToken).toBe(hashToken(rawToken));
    expect(created.verificationExpiresAt.getTime() - Date.now()).toBeGreaterThan(23 * 60 * 60 * 1000);
  });

  test('verify ищет по хешу, очищает токен и шлёт welcome', async () => {
    const raw = 'a'.repeat(64);
    const update = jest.fn();
    userRepository.findOne.mockResolvedValue({
      id: 7,
      email: 'fan@test.local',
      username: 'fan',
      isVerified: false,
      verificationToken: hashToken(raw),
      verificationExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      update,
    });

    const result = await authService.verify(raw);

    expect(userRepository.findOne).toHaveBeenCalledWith({ verificationToken: hashToken(raw) });
    expect(update).toHaveBeenCalledWith({
      isVerified: true,
      verificationToken: null,
      verificationExpiresAt: null,
    });
    expect(sendWelcomeEmail).toHaveBeenCalledWith('fan@test.local', 'fan');
    expect(result.isVerified).toBe(true);
  });

  test('verify отклоняет просроченную ссылку', async () => {
    const raw = 'b'.repeat(64);
    userRepository.findOne.mockResolvedValue({
      id: 8,
      verificationToken: hashToken(raw),
      verificationExpiresAt: new Date(Date.now() - 1000),
    });

    const result = await authService.verify(raw);

    expect(result).toEqual({
      error: 'Ссылка подтверждения устарела. Запросите новую на странице входа',
      status: 400,
    });
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
  });

  test('resendVerification обновляет токен и отвечает нейтральным сообщением', async () => {
    const update = jest.fn();
    userRepository.findByEmail.mockResolvedValue({
      id: 9,
      email: 'fan@test.local',
      isVerified: false,
      update,
    });

    const result = await authService.resendVerification(' FAN@Test.Local ');

    expect(result.status).toBe(200);
    expect(result.data.message).toMatch(/если аккаунт существует/i);
    const raw = sendVerificationEmail.mock.calls[0][1];
    expect(update.mock.calls[0][0].verificationToken).toBe(hashToken(raw));
  });

  test('resendVerification для неизвестного/подтверждённого email ничего не отправляет', async () => {
    const unknown = await authService.resendVerification('nobody@test.local');
    expect(unknown.status).toBe(200);
    expect(sendVerificationEmail).not.toHaveBeenCalled();

    userRepository.findByEmail.mockResolvedValue({ id: 10, isVerified: true });
    const verified = await authService.resendVerification('done@test.local');
    expect(verified.status).toBe(200);
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  test('в проде при отказе SMTP регистрация откатывается и возвращает 503', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    sendVerificationEmail.mockResolvedValue({ ok: false, error: 'SMTP is not configured' });

    try {
      const result = await authService.register({
        username: 'fan',
        email: 'fan@test.local',
        password: 'secret1',
      });

      expect(result.status).toBe(503);
      expect(result.error).toBe('Регистрация временно недоступна. Используйте демо-аккаунты.');
      expect(userRepository.remove).toHaveBeenCalledWith(42);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  test('отказ почты в любом окружении кроме test тоже откатывает пользователя', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    sendVerificationEmail.mockResolvedValue({
      ok: false,
      error: 'SMTP is not configured (missing: EMAIL_ENABLED)',
    });

    try {
      const result = await authService.register({
        username: 'fan',
        email: 'fan@test.local',
        password: 'secret1',
      });

      expect(result.status).toBe(503);
      expect(result.error).toBe('Регистрация временно недоступна. Используйте демо-аккаунты.');
      expect(userRepository.remove).toHaveBeenCalledWith(42);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
