const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/authenticate');
const userRepository = require('../repositories/userRepository');
const { sendVerificationEmail, sendWelcomeEmail } = require('./emailService');
const logger = require('../utils/logger');

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

function publicUser(user, extras = {}) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    ...extras,
  };
}

async function register({ username, email, password }) {
  if (!username || !email || !password) {
    return { error: 'Укажите имя пользователя, email и пароль', status: 400 };
  }
  if (typeof password !== 'string' || password.length < 6) {
    return { error: 'Пароль должен содержать минимум 6 символов', status: 400 };
  }

  const existing = await userRepository.findByEmail(email);
  if (existing) {
    return { error: 'Этот email уже зарегистрирован', status: 409 };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const verificationToken = crypto.randomUUID();
  const user = await userRepository.create({
    username,
    email,
    passwordHash,
    verificationToken,
    isVerified: false,
  });

  sendVerificationEmail(user.email, user.verificationToken);

  return {
    data: { message: 'Регистрация успешна. Проверьте почту, чтобы подтвердить email.' },
    status: 201,
  };
}

async function verify(rawToken) {
  if (!rawToken) {
    return { error: 'Не указан токен подтверждения', status: 400 };
  }

  const user = await userRepository.findOne({ verificationToken: rawToken });
  if (!user) {
    return { error: 'Ссылка подтверждения недействительна или устарела', status: 400 };
  }

  await user.update({ verificationToken: null, isVerified: true });

  sendWelcomeEmail(user.email, user.username);

  return publicUser(user);
}

async function login({ email, password }) {
  if (!email || !password) {
    return { error: 'Укажите email и пароль', status: 400 };
  }

  const user = await userRepository.findByEmail(email);
  if (!user) {
    logger.warn('auth.login', { email, result: 'unknown_email' });
    return { error: 'Неверный email или пароль', status: 401 };
  }

  if (!user.isVerified) {
    logger.warn('auth.login', { userId: user.id, email, result: 'not_verified' });
    return { error: 'Email не подтверждён. Проверьте почту.', status: 403 };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    logger.warn('auth.login', { userId: user.id, email, result: 'bad_password' });
    return { error: 'Неверный email или пароль', status: 401 };
  }

  logger.info('auth.login', { userId: user.id, email, result: 'success' });
  const token = signToken(user);
  return { data: { token, user: publicUser(user) } };
}

async function getMe(userId) {
  const user = await userRepository.findByIdWithFavorites(userId);
  if (!user) {
    return { error: 'Пользователь не найден', status: 404 };
  }
  const isActiveRecord = (record) => {
    const json = typeof record.toJSON === 'function' ? record.toJSON() : record;
    return json.isActive !== false;
  };

  return publicUser(user, {
    favoriteDrivers: (user.favoriteDrivers || []).filter(isActiveRecord),
    favoriteTeams: (user.favoriteTeams || []).filter(isActiveRecord),
  });
}

module.exports = { register, verify, login, getMe, publicUser };