'use strict';

/**
 * Эпик-13 (BUG-03/BUG-17): сообщения входа и регистрации — на русском.
 */

jest.mock('../src/repositories/userRepository');
jest.mock('../src/services/emailService', () => ({
  sendVerificationEmail: jest.fn(),
  sendWelcomeEmail: jest.fn(),
}));

const bcrypt = require('bcryptjs');
const userRepository = require('../src/repositories/userRepository');
const authService = require('../src/services/authService');

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(bcrypt, 'compare');
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
});
