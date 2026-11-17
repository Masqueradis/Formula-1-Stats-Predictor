const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/authenticate');
const userRepository = require('../repositories/userRepository');
const { sendVerificationEmail, sendWelcomeEmail } = require('./emailService');
const { generateVerificationToken, hashToken, isExpired } = require('../utils/verificationToken');
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

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await userRepository.findByEmail(normalizedEmail);
  if (existing) {
    return { error: 'Этот email уже зарегистрирован', status: 409 };
  }
  const existingUsername = await userRepository.findByUsername(username);
  if (existingUsername) {
    return { error: 'Это имя пользователя уже занято', status: 409 };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { token, tokenHash, expiresAt } = generateVerificationToken();
  const user = await userRepository.create({
    username,
    email: normalizedEmail,
    passwordHash,
    verificationToken: tokenHash,
    verificationExpiresAt: expiresAt,
    isVerified: false,
  });

  const sent = await deliverEmail(sendVerificationEmail, user.email, token);
  if (!sent.ok && process.env.NODE_ENV === 'production') {
    // Не оставляем аккаунт, для которого пользователь никогда не получит ссылку.
    await userRepository.remove(user.id);
    logger.error('auth.register.mail_failed', { userId: user.id, reason: sent.error });
    return {
      error: 'Не удалось отправить письмо подтверждения. Попробуйте позже.',
      status: 503,
      details: sent.error,
    };
  }
  if (!sent.ok) {
    logger.warn('auth.register.mail_failed', { userId: user.id, error: sent.error });
  }

  return {
    data: {
      message: 'Регистрация успешна. Проверьте почту, чтобы подтвердить email.',
      emailDelivered: sent.ok,
    },
    status: 201,
  };
}

/** Отправка письма не должна ронять регистрацию: причина возвращается вызывающему. */
async function deliverEmail(send, ...args) {
  try {
    return (await send(...args)) || { ok: false, error: 'Почтовый сервис не вернул результат' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function verify(rawToken) {
  if (!rawToken) {
    return { error: 'Не указан токен подтверждения', status: 400 };
  }

  const user = await userRepository.findOne({ verificationToken: hashToken(rawToken) });
  if (!user) {
    return { error: 'Ссылка подтверждения недействительна или уже использована', status: 400 };
  }
  if (isExpired(user.verificationExpiresAt)) {
    return { error: 'Ссылка подтверждения устарела. Запросите новую на странице входа', status: 400 };
  }

  const updates = {
    isVerified: true,
    verificationToken: null,
    verificationExpiresAt: null,
  };
  await user.update(updates);

  const sent = await deliverEmail(sendWelcomeEmail, user.email, user.username);
  if (!sent.ok) logger.warn('auth.verify.welcome_mail_failed', { userId: user.id, error: sent.error });

  // sequelize обновляет инстанс на месте; явный merge делает контракт стабильным и для моков.
  const plain = typeof user.toJSON === 'function' ? user.toJSON() : user;
  return publicUser({ ...plain, ...updates });
}

/** Повторная отправка ссылки. Ответ намеренно одинаковый для любого email. */
async function resendVerification(rawEmail) {
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  if (!email) {
    return { error: 'Укажите email', status: 400 };
  }

  const message = 'Если аккаунт существует и email ещё не подтверждён, мы отправили новую ссылку.';
  const user = await userRepository.findByEmail(email);
  if (!user || user.isVerified) {
    return { data: { message }, status: 200 };
  }

  const { token, tokenHash, expiresAt } = generateVerificationToken();
  await user.update({ verificationToken: tokenHash, verificationExpiresAt: expiresAt });

  const sent = await deliverEmail(sendVerificationEmail, user.email, token);
  if (!sent.ok && process.env.NODE_ENV === 'production') {
    return {
      error: 'Не удалось отправить письмо подтверждения. Попробуйте позже.',
      status: 503,
      details: sent.error,
    };
  }
  if (!sent.ok) logger.warn('auth.resend.mail_failed', { userId: user.id, error: sent.error });

  return { data: { message }, status: 200 };
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

module.exports = { register, verify, resendVerification, login, getMe, publicUser };