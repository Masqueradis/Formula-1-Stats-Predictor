'use strict';

const driverRepository = require('../repositories/driverRepository');
const logger = require('../utils/logger');

/**
 * Биографии и фото пилотов из Wikipedia REST API (эпик-09, P2).
 *
 * Стратегия:
 *  1) ru-Wikipedia: поиск `${firstName} ${lastName}` → summary первой статьи
 *     (заголовок, extract, миниатюра). Английское имя находит русскую статью
 *     через редиректы поиска (проверено: "Max Verstappen" → "Ферстаппен, Макс").
 *  2) en-Wikipedia: прямой summary `First_Last` (фото у русских статей часто
 *     отсутствует) — берём en-миниатюру, если в ru нет; extract — запасной.
 *  3) Кэш по driverId на 24 ч: статьи меняются редко, а нагрузка на Wikipedia
 *     (донор бесплатный, но с rate limit) минимальна.
 */

const SUMMARY_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_EXTRACT_LENGTH = 1200;

const cache = new Map();

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUMMARY_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'F1StatsPredictor/1.0 (contact: dev@example.com)' },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

function summaryUrl(lang, title) {
  const encoded = encodeURIComponent(title.replace(/ /g, '_'));
  return `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
}

async function searchFirstPage(lang, query) {
  const url = `https://${lang}.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=1`;
  const body = await fetchJson(url);
  return body?.pages?.[0] ?? null;
}

/** ru-статья: название статьи находим поиском, затем summary */
async function fetchRuSummary(fullName) {
  const page = await searchFirstPage('ru', fullName);
  if (!page?.key) return null;
  const summary = await fetchJson(summaryUrl('ru', page.key));
  if (!summary?.extract) return null;
  return {
    title: summary.title || page.key,
    extract: summary.extract,
    lang: 'ru',
    url: summary.content_urls?.desktop?.page || `https://ru.wikipedia.org/wiki/${encodeURIComponent(page.key)}`,
    thumbnail: summary.thumbnail?.source || null,
  };
}

/** en-статья: пробуем прямой заголовок `First Last`, иначе поиск */
async function fetchEnSummary(fullName) {
  let summary = await fetchJson(summaryUrl('en', fullName));
  if (!summary?.extract) {
    const page = await searchFirstPage('en', fullName);
    if (!page?.key) return null;
    summary = await fetchJson(summaryUrl('en', page.key));
  }
  if (!summary?.extract) return null;
  return {
    title: summary.title,
    extract: summary.extract,
    url: summary.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(summary.title)}`,
    thumbnail: summary.thumbnail?.source || null,
  };
}

async function getDriverWiki(rawId) {
  const id = Number.parseInt(rawId, 10);
  if (Number.isNaN(id)) return { error: 'Invalid id' };

  const driver = await driverRepository.findByIdWithDetails(id);
  if (!driver) return { error: 'driver not found', status: 404 };

  const cached = cache.get(id);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { ...cached.data, cached: true };
  }

  const fullName = `${driver.firstName} ${driver.lastName}`.trim();

  let ru = null;
  let en = null;
  try {
    // ru даёт русский текст; en — фото и запасной текст. Идём последовательно:
    // en нужен только если ru не справился (минимум запросов к донору)
    ru = await fetchRuSummary(fullName);
    if (!ru?.thumbnail) {
      en = await fetchEnSummary(fullName);
    }
  } catch (err) {
    logger.warn('wiki.fetch_failed', { driverId: id, reason: err.message });
    throw httpError(502, 'Wikipedia is unavailable');
  }

  if (!ru && !en) {
    throw httpError(404, 'No Wikipedia article for this driver');
  }

  const primary = ru || en;
  const data = {
    driverId: id,
    title: primary.title,
    extract: primary.extract.slice(0, MAX_EXTRACT_LENGTH),
    lang: primary.lang || 'en',
    url: primary.url,
    thumbnail: primary.thumbnail || en?.thumbnail || null,
    cached: false,
  };

  cache.set(id, { data, fetchedAt: Date.now() });
  logger.info('wiki.fetched', { driverId: id, lang: data.lang, hasThumbnail: Boolean(data.thumbnail) });
  return data;
}

module.exports = { getDriverWiki };
