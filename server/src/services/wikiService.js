'use strict';

const driverRepository = require('../repositories/driverRepository');
const cacheService = require('../cache/cacheService');
const cacheKeys = require('../cache/keys');
const logger = require('../utils/logger');

const SUMMARY_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_EXTRACT_LENGTH = 1200;

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

  const cacheKey = cacheKeys.wiki(id);
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  const fullName = `${driver.firstName} ${driver.lastName}`.trim();

  let ru = null;
  let en = null;
  try {
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

  await cacheService.set(cacheKey, data, CACHE_TTL_MS);
  logger.info('wiki.fetched', { driverId: id, lang: data.lang, hasThumbnail: Boolean(data.thumbnail) });
  return data;
}

module.exports = { getDriverWiki };
