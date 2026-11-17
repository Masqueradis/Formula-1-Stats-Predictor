'use strict';

const crypto = require('crypto');

/** Срок действия ссылки подтверждения — 24 часа (как указано в письме). */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** В БД хранится только хеш токена: утечка БД не даёт возможности подтвердить чужой email. */
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function generateVerificationToken(now = new Date()) {
  const token = crypto.randomBytes(32).toString('hex');
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
  };
}

function isExpired(expiresAt, now = new Date()) {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() <= now.getTime();
}

module.exports = { TOKEN_TTL_MS, hashToken, generateVerificationToken, isExpired };
