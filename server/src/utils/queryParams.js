'use strict';

const SEARCH_MAX_LENGTH = 60;

function cleanSearch(value, maxLength = SEARCH_MAX_LENGTH) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function clampInt(value, { min = 1, max = 100, fallback = null } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function cleanId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

module.exports = { SEARCH_MAX_LENGTH, cleanSearch, clampInt, cleanId };
