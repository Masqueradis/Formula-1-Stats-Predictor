const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/authenticate');
const userRepository = require('../repositories/userRepository');

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
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    ...extras,
  };
}

async function register({ username, email, password }) {
  if (!username || !email || !password) {
    return { error: 'username, email and password are required' };
  }
  if (typeof password !== 'string' || password.length < 6) {
    return { error: 'Password must be at least 6 characters long' };
  }

  const existing = await userRepository.findByEmail(email);
  if (existing) {
    return { error: 'Email already registered', status: 409 };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await userRepository.create({ username, email, passwordHash });

  const token = signToken(user);
  return { data: { token, user: publicUser(user) }, status: 201 };
}

async function login({ email, password }) {
  if (!email || !password) {
    return { error: 'email and password are required' };
  }

  const user = await userRepository.findByEmail(email);
  if (!user) {
    return { error: 'Invalid credentials', status: 401 };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { error: 'Invalid credentials', status: 401 };
  }

  const token = signToken(user);
  return { data: { token, user: publicUser(user) } };
}

async function getMe(userId) {
  const user = await userRepository.findByIdWithFavorites(userId);
  if (!user) {
    return { error: 'User not found', status: 404 };
  }
  return publicUser(user, {
    favoriteDrivers: user.favoriteDrivers,
    favoriteTeams: user.favoriteTeams,
  });
}

module.exports = { register, login, getMe, publicUser };
