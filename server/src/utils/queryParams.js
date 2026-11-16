'use strict';

/**
 * Эпик-13 (BUG-20): защита query-параметров на бэкенде.
 * Поисковые строки обрезаются по длине, числовые параметры приводятся к
 * безопасному диапазону — вместо падения SQL/Sequelize на гигантском вводе.
 */

const SEARCH_MAX_LENGTH = 60;

/** Строка поиска: trim + ограничение длины. Пустая строка → null. */
function cleanSearch(value, maxLength = SEARCH_MAX_LENGTH) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

/** Целое число в диапазоне [min; max]; иначе fallback. */
function clampInt(value, { min = 1, max = 100, fallback = null } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

/** Положительный id из query/params; null — если не число. */
function cleanId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

module.exports = { SEARCH_MAX_LENGTH, cleanSearch, clampInt, cleanId };
