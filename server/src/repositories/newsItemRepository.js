'use strict';

const { Op } = require('sequelize');
const { NewsItem, sequelize } = require('../models');

const MAX_LIMIT = 48;
const DEFAULT_LIMIT = 12;

function parseDate(value, endOfDay = false) {
  if (!value) return null;
  const suffix = endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
  const date = new Date(`${value}${suffix}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toItem(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: plain.link,
    source: { id: plain.sourceId, name: plain.sourceName || plain.sourceId },
    lang: plain.lang,
    title: plain.title,
    link: plain.link,
    description: plain.description,
    publishedAt: plain.publishedAt ? new Date(plain.publishedAt).toISOString() : null,
    image: plain.imageUrl,
  };
}

/** Свежая лента RSS → upsert по link (идемпотентно; архив не растёт дублями) */
async function upsertMany(items) {
  const rows = (items || [])
    .filter((item) => item?.link && item?.title)
    .map((item) => ({
      link: item.link,
      title: item.title.slice(0, 500),
      description: item.description || null,
      sourceId: item.source?.id || 'unknown',
      sourceName: item.source?.name || null,
      lang: item.lang || null,
      imageUrl: item.image || null,
      publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
    }));
  if (!rows.length) return 0;

  await NewsItem.bulkCreate(rows, {
    updateOnDuplicate: ['title', 'description', 'sourceName', 'lang', 'imageUrl', 'publishedAt', 'updatedAt'],
  });
  return rows.length;
}

/**
 * Поиск по архиву: полнотекстовый tsvector @@ plainto_tsquery('simple', q)
 * + ILIKE-фолбэк на подстроку (поиск по части слова/точному обороту).
 */
async function search({ q, from, to, page = 1, limit = DEFAULT_LIMIT } = {}) {
  const where = {};

  const fromDate = parseDate(from);
  const toDate = parseDate(to, true);
  if (fromDate || toDate) {
    where.publishedAt = {};
    if (fromDate) where.publishedAt[Op.gte] = fromDate;
    if (toDate) where.publishedAt[Op.lte] = toDate;
  }

  const term = (q || '').trim();
  if (term) {
    const like = `%${term}%`;
    where[Op.and] = [
      sequelize.literal(
        `("searchVector" @@ plainto_tsquery('simple', ${sequelize.escape(term)})`
        + ` OR "title" ILIKE ${sequelize.escape(like)}`
        + ` OR coalesce("description", '') ILIKE ${sequelize.escape(like)})`,
      ),
    ];
  }

  const safeLimit = Math.min(Math.max(1, Number(limit) || DEFAULT_LIMIT), MAX_LIMIT);
  const safePage = Math.max(1, Number(page) || 1);

  const { count, rows } = await NewsItem.findAndCountAll({
    where,
    order: [
      [sequelize.literal('"publishedAt" DESC NULLS LAST')],
      ['id', 'DESC'],
    ],
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
  });

  return {
    items: rows.map(toItem),
    total: count,
    page: safePage,
    limit: safeLimit,
    totalPages: count ? Math.ceil(count / safeLimit) : 0,
  };
}

module.exports = { upsertMany, search };
