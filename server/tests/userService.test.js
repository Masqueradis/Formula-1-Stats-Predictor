'use strict';

jest.mock('../src/repositories/userRepository');

const userRepository = require('../src/repositories/userRepository');
const userService = require('../src/services/userService');

function record(overrides = {}) {
  return {
    toJSON: () => ({
      id: 1,
      username: 'maxfan',
      email: 'maxfan@f1stats.test',
      role: 'USER',
      isVerified: false,
      passwordHash: '$2b$10$secret',
      verificationToken: 'super-secret-token',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('userService.sanitize', () => {
  test('getAll скрывает passwordHash и verificationToken', async () => {
    userRepository.findAll.mockResolvedValue([record()]);

    const users = await userService.getAll();

    expect(users).toHaveLength(1);
    expect(users[0]).not.toHaveProperty('passwordHash');
    expect(users[0]).not.toHaveProperty('verificationToken');
    expect(users[0]).toMatchObject({ id: 1, username: 'maxfan', isVerified: false });
  });

  test('getById скрывает секреты и возвращает запись', async () => {
    userRepository.findById.mockResolvedValue(record({ id: 7 }));

    const user = await userService.getById(7);

    expect(user.id).toBe(7);
    expect(user).not.toHaveProperty('passwordHash');
    expect(user).not.toHaveProperty('verificationToken');
  });

  test('getById с невалидным id не обращается к репозиторию', async () => {
    const result = await userService.getById('abc');

    expect(result).toEqual({ error: 'Invalid id' });
    expect(userRepository.findById).not.toHaveBeenCalled();
  });
});
