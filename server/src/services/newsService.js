'use strict';

const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');
const { Driver, Team } = require('../models');
const newsItemRepository = require('../repositories/newsItemRepository');
const logger = require('../utils/logger');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
});

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_DIR = path.join(__dirname, '..', '..', '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'news.json');

const SOURCES = [
  {
    id: 'bbc',
    name: 'BBC Sport',
    lang: 'en',
    url: 'https://feeds.bbci.co.uk/sport/formula1/rss.xml',
  },
  {
    id: 'f1i',
    name: 'F1i.com',
    lang: 'en',
    url: 'https://f1i.com/feed',
  },
  {
    id: 'espn',
    name: 'ESPN',
    lang: 'en',
    url: 'https://www.espn.com/espn/rss/f1/news',
  },
  {
    id: 'google-news-ru',
    name: 'Google News',
    lang: 'ru',
    url: 'https://news.google.com/rss/search?q=formula+1&hl=ru&gl=RU&ceid=RU:ru',
  },
  {
    id: 'motorsport',
    name: 'Motorsport.com',
    lang: 'en',
    url: 'https://www.motorsport.com/rss/f1/news/',
  },
  {
    id: 'autosport',
    name: 'Autosport',
    lang: 'en',
    url: 'https://www.autosport.com/rss/f1/news/',
  },
  {
    id: 'racefans',
    name: 'RaceFans',
    lang: 'en',
    url: 'https://www.racefans.net/feed/',
  },
  {
    id: 'the-race',
    name: 'The Race',
    lang: 'en',
    url: 'https://www.the-race.com/rss/',
  },
  {
    id: 'sky-sports',
    name: 'Sky Sports',
    lang: 'en',
    url: 'https://www.skysports.com/rss/12433',
  },
];

const MAX_POOL = 300;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 48;
const MAX_DESCRIPTION_LENGTH = 200;
const MIN_KEYWORD_LENGTH = 3;

const cache = {
  items: null,
  fetchedAt: 0,
};

async function fetchXml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (F1StatsPredictor/1.0)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

function safeArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value['#text'] != null ? value['#text'] : '';
}

function extractImage(item) {
  const candidates = [item.thumbnail, item.content, item.enclosure];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === 'string') {
      if (/^https?:\/\//i.test(candidate)) return candidate;
      continue;
    }
    const url = candidate['@_url'];
    if (url && /^https?:\/\//i.test(url)) return url;
    const media = candidate.content;
    if (media && typeof media === 'object' && media['@_url']) return media['@_url'];
  }
  return null;
}

/**
 * Дата из RSS: JS не понимает аббревиатуры зон (BST, CEST у Sky Sports/Autosport),
 * из-за чего new Date() → Invalid Date и toISOString() ронял весь источник.
 * Пробуем напрямую, затем подставляем смещение по таблице, иначе null.
 */
const TZ_OFFSETS = {
  BST: '+0100',
  CET: '+0100',
  CEST: '+0200',
  EET: '+0200',
  EEST: '+0300',
  EST: '-0500',
  EDT: '-0400',
  CST: '-0600',
  CDT: '-0500',
  MST: '-0700',
  MDT: '-0600',
  PST: '-0800',
  PDT: '-0700',
  JST: '+0900',
  AEST: '+1000',
};

function parsePublishedAt(value) {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString();

  const match = String(value).match(/\b([A-Z]{2,4})\s*$/);
  const offset = match ? TZ_OFFSETS[match[1]] : null;
  if (offset) {
    const replaced = new Date(String(value).replace(/\b[A-Z]{2,4}\s*$/, offset));
    if (!Number.isNaN(replaced.getTime())) return replaced.toISOString();
  }
  return null;
}

function parseRss(xml) {
  const doc = parser.parse(xml);
  const items = safeArray(doc?.rss?.channel?.item);
  if (!items.length) return [];
  return items.map((item) => ({
    title: stripHtml(extractText(item.title)),
    link: extractText(item.link),
    guid: extractText(item.guid) || extractText(item.link),
    description: stripHtml(extractText(item.description)).slice(0, MAX_DESCRIPTION_LENGTH),
    publishedAt: parsePublishedAt(item.pubDate),
    image: extractImage(item),
    sourceTag: extractText(item.source).trim(),
  }));
}

async function fetchSource(source) {
  const xml = await fetchXml(source.url);
  const items = parseRss(xml);
  return items.map((item) => {
    const sourceName = item.sourceTag || source.name;
    const title = source.id === 'google-news-ru'
      ? item.title.replace(new RegExp(`\\s*-\\s*${sourceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'), '')
      : item.title;
    return {
      id: item.guid || item.link,
      source: { id: source.id, name: sourceName },
      lang: source.lang,
      title,
      link: item.link,
      description: item.description,
      publishedAt: item.publishedAt,
      image: item.image,
    };
  });
}

function normalizeItems(items) {
  const sourceById = new Map(SOURCES.map((s) => [s.id, s.name]));
  const byLink = new Map();
  for (const item of items) {
    const key = item.link || item.id;
    if (!key || byLink.has(key)) continue;
    byLink.set(key, {
      ...item,
      source: {
        id: item.source?.id,
        name: item.source?.name || sourceById.get(item.source?.id) || 'F1 Feed',
      },
    });
  }
  return [...byLink.values()]
    .filter((item) => item.title)
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
    .slice(0, MAX_POOL);
}

async function fetchAll() {
  const results = await Promise.allSettled(SOURCES.map((source) => fetchSource(source)));
  return normalizeItems(
    results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => r.value),
  );
}

function readDiskCache() {
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.items) || !parsed.items.length) return null;
    return { items: parsed.items, fetchedAt: Number(parsed.fetchedAt) || 0 };
  } catch {
    return null;
  }
}

function writeDiskCache(items, fetchedAt) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ fetchedAt, items }), 'utf8');
  } catch (err) {
    console.warn('[newsService] failed to write disk cache:', err.message);
  }
}

async function loadPool() {
  const now = Date.now();
  if (cache.items && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { items: cache.items, fetchedAt: cache.fetchedAt, cached: true };
  }

  let fresh = [];
  try {
    fresh = await fetchAll();
  } catch {
    fresh = [];
  }

  if (fresh.length) {
    cache.items = fresh;
    cache.fetchedAt = now;
    writeDiskCache(fresh, now);
    // Архив в Postgres (эпик-09, P4): сбой записи не должен ломать ленту
    await newsItemRepository.upsertMany(fresh)
      .catch((err) => logger.warn('news.archive_failed', { reason: err.message }));
    return { items: fresh, fetchedAt: now, cached: false };
  }

  if (cache.items) {
    return { items: cache.items, fetchedAt: cache.fetchedAt, cached: true, stale: true };
  }

  const disk = readDiskCache();
  if (disk) {
    cache.items = disk.items;
    cache.fetchedAt = disk.fetchedAt;
    return { items: disk.items, fetchedAt: disk.fetchedAt, cached: true, stale: true };
  }

  return { items: [], fetchedAt: 0, offline: true };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function keywordsFromDriver(driver) {
  if (!driver) return [];
  const full = `${driver.firstName} ${driver.lastName}`.trim();
  return [full, driver.lastName, driver.abbreviation].filter(Boolean);
}

function keywordsFromTeam(team) {
  if (!team) return [];
  return [team.name].filter(Boolean);
}

async function resolveKeywordGroups({ driverId, teamId }) {
  const groups = [];
  if (driverId) {
    const driver = await Driver.findByPk(Number(driverId)).catch(() => null);
    const group = keywordsFromDriver(driver && driver.isActive !== false ? driver : null).filter(
      (k) => String(k).trim().length >= MIN_KEYWORD_LENGTH,
    );
    if (group.length) groups.push(group);
  }
  if (teamId) {
    const team = await Team.findByPk(Number(teamId)).catch(() => null);
    const group = keywordsFromTeam(team && team.isActive !== false ? team : null).filter(
      (k) => String(k).trim().length >= MIN_KEYWORD_LENGTH,
    );
    if (group.length) groups.push(group);
  }
  return groups;
}

function parseDayBound(value, endOfDay) {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function inDateRange(publishedAt, from, to) {
  if (!from && !to) return true;
  if (!publishedAt) return false;
  const ts = new Date(publishedAt).getTime();
  if (Number.isNaN(ts)) return false;
  if (from && ts < from) return false;
  if (to && ts > to) return false;
  return true;
}

function applyFilters(items, { source, lang, search, keywordGroups, from, to }) {
  return items.filter((item) => {
    if (source && item.source?.id !== source) return false;
    if (lang && item.lang !== lang) return false;
    if (!inDateRange(item.publishedAt, from, to)) return false;

    const haystack = `${item.title || ''} ${item.description || ''}`;
    if (search && !new RegExp(escapeRegExp(search), 'i').test(haystack)) return false;

    return keywordGroups.every((group) =>
      group.some((kw) => new RegExp(escapeRegExp(kw), 'i').test(haystack)),
    );
  });
}

function toPositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

async function getNews(options = {}) {
  const {
    source = null,
    lang = null,
    search = null,
    driverId = null,
    teamId = null,
    from = null,
    to = null,
  } = options;

  const page = toPositiveInt(options.page, 1);
  const limit = Math.min(toPositiveInt(options.limit, DEFAULT_LIMIT), MAX_LIMIT);
  const fromDate = parseDayBound(from, false);
  const toDate = parseDayBound(to, true);

  const pool = await loadPool();
  const keywordGroups = await resolveKeywordGroups({ driverId, teamId }).catch(() => []);

  const filtered = applyFilters(pool.items, {
    source,
    lang,
    search,
    keywordGroups,
    from: fromDate,
    to: toDate,
  });
  const total = filtered.length;
  const totalPages = total ? Math.ceil(total / limit) : 0;
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);

  return {
    items,
    page,
    limit,
    total,
    totalPages,
    hasMore: start + items.length < total,
    sources: SOURCES.map(({ id, name, lang: sourceLang }) => ({ id, name, lang: sourceLang })),
    cached: Boolean(pool.cached),
    stale: Boolean(pool.stale),
    offline: Boolean(pool.offline),
  };
}

/**
 * Поиск по архиву новостей в Postgres (эпик-09, P4):
 * полнотекстовый (tsvector) + подстрочный (ILIKE), фильтр по датам.
 */
async function searchArchive(options = {}) {
  const result = await newsItemRepository.search(options);
  const start = (result.page - 1) * result.limit;
  return {
    ...result,
    hasMore: start + result.items.length < result.total,
    sources: SOURCES.map(({ id, name, lang: sourceLang }) => ({ id, name, lang: sourceLang })),
    archive: true,
    cached: false,
    stale: false,
    offline: false,
  };
}

module.exports = { getNews, searchArchive, SOURCES };
