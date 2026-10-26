const newsService = require('../services/newsService');
const apiResponse = require('../utils/apiResponse');

async function getNews(req, res) {
  try {
    const { page, limit, source, lang, search, driverId, teamId, from, to } = req.query;
    const result = await newsService.getNews({
      page,
      limit,
      source,
      lang,
      search,
      driverId,
      teamId,
      from,
      to,
    });
    return apiResponse.success(res, result);
  } catch (err) {
    return apiResponse.error(res, 'Failed to load news', 500, err.message);
  }
}

/** Архив новостей в Postgres: полнотекстовый поиск + фильтр по датам (эпик-09, P4) */
async function getArchive(req, res) {
  try {
    const { q, from, to, page, limit } = req.query;
    const result = await newsService.searchArchive({ q, from, to, page, limit });
    return apiResponse.success(res, result);
  } catch (err) {
    return apiResponse.error(res, 'Failed to search news archive', 500, err.message);
  }
}

module.exports = { getNews, getArchive };
