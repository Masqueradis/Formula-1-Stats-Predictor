'use strict';

const DEFAULT_BASE_URL = 'https://api.jolpi.ca/ergast/f1';
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_TTL_MS = 10 * 60 * 1000;
const MIN_INTERVAL_MS = 260;
const MAX_RETRIES = 3;

const cacheService = require('../cache/cacheService');
const cacheKeys = require('../cache/keys');

let lastRequestAt = 0;
let queue = Promise.resolve();

function baseUrl() {
  return (process.env.JOLPICA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function throttle() {
  const run = queue.then(async () => {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
  });
  queue = run.catch(() => {});
  return run;
}

async function fetchJson(url, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'f1-stats-coursework/1.0' },
    });
    if (!response.ok) {
      const err = new Error(`Jolpica request failed: ${response.status} ${response.statusText}`);
      err.status = response.status;
      const retryAfter = response.headers.get('retry-after');
      if (retryAfter) err.retryAfter = Number(retryAfter) * 1000;
      throw err;
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(path, { ttl = DEFAULT_TTL_MS, timeout, retries = MAX_RETRIES } = {}) {
  const url = `${baseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const cacheKey = cacheKeys.jolpica(url);
  const cached = await cacheService.get(cacheKey);
  if (cached !== null && cached !== undefined) {
    return cached;
  }

  let attempt = 0;
  for (;;) {
    await throttle();
    try {
      const value = await fetchJson(url, { timeout });
      await cacheService.set(cacheKey, value, ttl);
      return value;
    } catch (err) {
      attempt += 1;
      const retriable = err.status === 429 || err.status >= 500 || err.name === 'AbortError';
      if (!retriable || attempt > retries) throw err;
      const backoff = err.retryAfter || Math.min(8000, 500 * 2 ** attempt);
      await sleep(backoff);
    }
  }
}

async function clearCache() {
  await cacheService.delByPrefix(cacheKeys.prefixes.jolpica);
}

module.exports = { getJson, clearCache, baseUrl };
