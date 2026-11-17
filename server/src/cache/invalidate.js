'use strict';

const cacheService = require('./cacheService');
const keys = require('./keys');

async function invalidateApiCache() {
  await cacheService.delByPrefix(keys.prefixes.api);
}

module.exports = { invalidateApiCache };
