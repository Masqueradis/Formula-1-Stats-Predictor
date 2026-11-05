'use strict';

const cacheService = require('./cacheService');
const keys = require('./keys');

/**
 * Инвалидация HTTP-кэша публичных GET после изменения данных.
 * Префиксная очистка безопасна для курсового объёма и страхуется TTL.
 */
async function invalidateApiCache() {
  await cacheService.delByPrefix(keys.prefixes.api);
}

module.exports = { invalidateApiCache };
