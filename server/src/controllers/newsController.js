const newsService = require('../services/newsService');
const apiResponse = require('../utils/apiResponse');

async function getNews(req, res) {
  try {
    const { page, limit, source, lang, search, driverId, teamId } = req.query;
    const result = await newsService.getNews({
      page,
      limit,
      source,
      lang,
      search,
      driverId,
      teamId,
    });
    return apiResponse.success(res, result);
  } catch (err) {
    return apiResponse.error(res, 'Failed to load news', 500, err.message);
  }
}

module.exports = { getNews };
