'use strict';

/**
 * newsService — юнит-тесты с моком fetch (без сети и без БД).
 * Дисковый кэш мокан через fs, ин-мем кэш сбрасывается isolateModules.
 */

jest.mock('fs', () => ({
  readFileSync: jest.fn(() => {
    throw new Error('ENOENT: no cache');
  }),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

// newsService тянет models для keyword-фильтров (driverId/teamId) — в юнит-тестах БД нет
jest.mock('../src/models', () => ({
  Driver: { findByPk: jest.fn(async () => null) },
  Team: { findByPk: jest.fn(async () => null) },
}));

// Архив в Postgres (todo 14) — мок репозитория, БД в юнит-тестах нет
jest.mock('../src/repositories/newsItemRepository', () => ({
  upsertMany: jest.fn(async () => 0),
  search: jest.fn(async () => ({ items: [], total: 0, page: 1, limit: 12, totalPages: 0 })),
}));

const fs = require('fs');

const BBC = 'bbci.co.uk';
const F1I = 'f1i.com';
const ESPN = 'espn.com';
const GOOGLE = 'news.google.com';

function rss(itemsXml) {
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>F1 Feed</title>${itemsXml}</channel></rss>`;
}

function rssItem({ title, link, guid, description = 'Plain description', pubDate, enclosure, source }) {
  return [
    '<item>',
    `<title>${title}</title>`,
    `<link>${link}</link>`,
    `<guid>${guid || link}</guid>`,
    `<description><![CDATA[${description}]]></description>`,
    pubDate ? `<pubDate>${pubDate}</pubDate>` : '',
    enclosure ? `<enclosure url="${enclosure}" type="image/jpeg"/>` : '',
    source ? `<source>${source}</source>` : '',
    '</item>',
  ].join('');
}

function mockFetch(routes, { fail = [] } = {}) {
  global.fetch = jest.fn(async (url) => {
    const u = String(url);
    if (fail.some((frag) => u.includes(frag))) {
      return { ok: false, status: 503, statusText: 'Service Unavailable', text: async () => '' };
    }
    const hit = Object.entries(routes).find(([frag]) => u.includes(frag));
    if (!hit) {
      return { ok: false, status: 404, statusText: 'Not Found', text: async () => '' };
    }
    return { ok: true, status: 200, text: async () => hit[1] };
  });
}

let lastRepo = null;

function loadService() {
  let service;
  jest.isolateModules(() => {
    lastRepo = require('../src/repositories/newsItemRepository');
    service = require('../src/services/newsService');
  });
  return service;
}

describe('newsService (мок fetch)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.readFileSync.mockImplementation(() => {
      throw new Error('ENOENT: no cache');
    });
  });

  afterAll(() => {
    delete global.fetch;
  });

  test('собирает ленту из всех источников, чистит HTML и обрезает description', async () => {
    mockFetch({
      [BBC]: rss(
        rssItem({
          title: 'Verstappen &amp; Red Bull dominate',
          link: 'https://bbc.test/a',
          description: `<p>${'Race report word. '.repeat(20)}</p>`,
          pubDate: 'Thu, 22 Oct 2026 12:00:00 GMT',
          enclosure: 'https://img.test/a.jpg',
        }),
      ),
      [F1I]: rss(''),
      [ESPN]: rss(''),
      [GOOGLE]: rss(''),
    });

    const service = loadService();
    const result = await service.getNews();

    expect(result.offline).toBe(false);
    expect(result.cached).toBe(false);
    expect(result.sources).toHaveLength(9);

    const item = result.items.find((i) => i.link === 'https://bbc.test/a');
    expect(item).toBeDefined();
    expect(item.title).toBe('Verstappen & Red Bull dominate');
    expect(item.lang).toBe('en');
    expect(item.source.id).toBe('bbc');
    // HTML вычищен, длина ≤ 200 (MAX_DESCRIPTION_LENGTH)
    expect(item.description).not.toMatch(/<p>/);
    expect(item.description.length).toBeLessThanOrEqual(200);
    expect(item.publishedAt).toBe('2026-10-22T12:00:00.000Z');
    expect(item.image).toBe('https://img.test/a.jpg');

    // свежая лента пишется в дисковый кэш
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(fs.mkdirSync).toHaveBeenCalled();

    // и в архив Postgres (todo 14) — одним вызовом upsertMany
    expect(lastRepo.upsertMany).toHaveBeenCalledTimes(1);
    const archived = lastRepo.upsertMany.mock.calls[0][0];
    expect(archived.map((i) => i.link)).toContain('https://bbc.test/a');
  });

  test('убирает дубли по link и сортирует по дате (новые сверху)', async () => {
    mockFetch({
      [BBC]: rss(
        rssItem({ title: 'Older item', link: 'https://dup.test/a', pubDate: 'Wed, 21 Oct 2026 12:00:00 GMT' }),
      ),
      [F1I]: rss([
        rssItem({ title: 'Same link from F1I', link: 'https://dup.test/a', pubDate: 'Thu, 22 Oct 2026 09:00:00 GMT' }),
        rssItem({ title: 'Newest item', link: 'https://f1i.test/new', pubDate: 'Thu, 22 Oct 2026 13:00:00 GMT' }),
      ].join('')),
      [ESPN]: rss(''),
      [GOOGLE]: rss(''),
    });

    const service = loadService();
    const result = await service.getNews();

    const links = result.items.map((i) => i.link);
    expect(links.filter((l) => l === 'https://dup.test/a')).toHaveLength(1);
    expect(result.total).toBe(2);
    expect(result.items[0].link).toBe('https://f1i.test/new');
  });

  test('фильтрует по source/lang/search и пагинирует', async () => {
    mockFetch({
      [BBC]: rss([
        rssItem({ title: 'Verstappen wins', link: 'https://bbc.test/w1', pubDate: 'Thu, 22 Oct 2026 12:00:00 GMT' }),
        rssItem({ title: 'Pit stop rules (explained)', link: 'https://bbc.test/w2', pubDate: 'Thu, 22 Oct 2026 11:00:00 GMT' }),
      ].join('')),
      [F1I]: rss(''),
      [ESPN]: rss(''),
      [GOOGLE]: rss(
        rssItem({ title: 'Ферстаппен победил', link: 'https://google.test/ru1', pubDate: 'Thu, 22 Oct 2026 10:00:00 GMT' }),
      ),
    });

    const service = loadService();

    const bySource = await service.getNews({ source: 'bbc' });
    expect(bySource.total).toBe(2);
    expect(bySource.items.every((i) => i.source.id === 'bbc')).toBe(true);

    const byLang = await service.getNews({ lang: 'ru' });
    expect(byLang.total).toBe(1);
    expect(byLang.items[0].title).toBe('Ферстаппен победил');

    const bySearch = await service.getNews({ search: 'Verstappen' });
    expect(bySearch.total).toBe(1);
    expect(bySearch.items[0].link).toBe('https://bbc.test/w1');

    // спецсимволы в поиске не роняют RegExp
    const tricky = await service.getNews({ search: 'rules (explained)' });
    expect(tricky.total).toBe(1);

    // фильтр по датам (границы суток UTC)
    const byDate = await service.getNews({ from: '2026-10-22', to: '2026-10-22' });
    expect(byDate.total).toBe(3);
    const older = await service.getNews({ to: '2026-10-21' });
    expect(older.total).toBe(0);

    const page2 = await service.getNews({ limit: 2, page: 2 });
    expect(page2.items).toHaveLength(1);
    expect(page2.totalPages).toBe(2);
    expect(page2.hasMore).toBe(false);

    const page99 = await service.getNews({ page: 99 });
    expect(page99.items).toHaveLength(0);
    expect(page99.hasMore).toBe(false);
  });

  test('google-news-ru: убирает суффикс источника из заголовка', async () => {
    mockFetch({
      [BBC]: rss(''),
      [F1I]: rss(''),
      [ESPN]: rss(''),
      [GOOGLE]: rss(
        rssItem({
          title: 'Ферстаппен победил в США - Google News',
          link: 'https://google.test/suffix',
          pubDate: 'Thu, 22 Oct 2026 10:00:00 GMT',
        }),
      ),
    });

    const service = loadService();
    const result = await service.getNews({ source: 'google-news-ru' });

    expect(result.total).toBe(1);
    expect(result.items[0].title).toBe('Ферстаппен победил в США');
  });

  test('повторный вызов в пределах TTL отдаёт кэш (cached: true)', async () => {
    mockFetch({
      [BBC]: rss(rssItem({ title: 'Cached item', link: 'https://bbc.test/c', pubDate: 'Thu, 22 Oct 2026 12:00:00 GMT' })),
      [F1I]: rss(''),
      [ESPN]: rss(''),
      [GOOGLE]: rss(''),
    });

    const service = loadService();
    const first = await service.getNews();
    const callsAfterFirst = global.fetch.mock.calls.length;

    const second = await service.getNews();
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(global.fetch.mock.calls.length).toBe(callsAfterFirst);
  });

  test('все источники упали и нет кэшей → offline: true, пустая лента', async () => {
    mockFetch({}, { fail: [BBC, F1I, ESPN, GOOGLE] });

    const service = loadService();
    const result = await service.getNews();

    expect(result.offline).toBe(true);
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  test('упавший fetch отдаёт устаревший дисковый кэш (stale: true)', async () => {    const staleItems = [
      {
        id: 'cached-1',
        source: { id: 'bbc', name: 'BBC Sport' },
        lang: 'en',
        title: 'Cached headline',
        link: 'https://cache.test/1',
        description: 'from disk',
        publishedAt: '2026-10-01T00:00:00.000Z',
        image: null,
      },
    ];
    fs.readFileSync.mockReturnValue(JSON.stringify({ fetchedAt: 1, items: staleItems }));
    mockFetch({}, { fail: [BBC, F1I, ESPN, GOOGLE] });

    const service = loadService();
    const result = await service.getNews();

    expect(result.stale).toBe(true);
    expect(result.cached).toBe(true);
    expect(result.items[0].title).toBe('Cached headline');
  });

  test('searchArchive оборачивает результат репозитория и считает hasMore', async () => {
    const service = loadService();
    lastRepo.search.mockResolvedValue({
      items: [{ title: 'Archived' }],
      total: 30,
      page: 2,
      limit: 12,
      totalPages: 3,
    });

    const result = await service.searchArchive({ q: 'Verstappen', from: '2026-01-01', page: 2, limit: 12 });

    expect(lastRepo.search).toHaveBeenCalledWith({ q: 'Verstappen', from: '2026-01-01', page: 2, limit: 12 });
    expect(result).toMatchObject({
      total: 30,
      page: 2,
      hasMore: true, // offset 12 + 1 < 30
      archive: true,
      offline: false,
    });
    expect(result.sources).toHaveLength(9);
  });

  test('аббревиатуры зон в pubDate (BST/CEST) не роняют источник', async () => {
    mockFetch({
      [BBC]: rss(rssItem({
        title: 'BST item',
        link: 'https://bbc.test/bst',
        pubDate: 'Thu, 22 Oct 2026 06:00:00 BST',
      })),
      [F1I]: rss(rssItem({
        title: 'CEST item',
        link: 'https://f1i.test/cest',
        pubDate: 'Thu, 22 Oct 2026 12:00:00 CEST',
      })),
      [ESPN]: rss(''),
      [GOOGLE]: rss(''),
    });

    const service = loadService();
    const result = await service.getNews();

    // Sky Sports/Autosport отдают BST/CEST — раньше Invalid Date.toISOString() ронял весь источник
    const bst = result.items.find((i) => i.link === 'https://bbc.test/bst');
    const cest = result.items.find((i) => i.link === 'https://f1i.test/cest');
    expect(bst.publishedAt).toBe('2026-10-22T05:00:00.000Z');
    expect(cest.publishedAt).toBe('2026-10-22T10:00:00.000Z');
  });
});
