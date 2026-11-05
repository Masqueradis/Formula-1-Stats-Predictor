'use strict';

/**
 * Единое пространство ключей Redis (эпик-11).
 *
 * Все ключи начинаются с `f1:`, чтобы инфраструктурные данные не смешивались
 * с чужими ключами в общем Redis. Префиксы доменов нужны для инвалидации
 * через SCAN + UNLINK.
 */

const PREFIX = 'f1:';

function key(...parts) {
  return `${PREFIX}${parts.join(':')}`;
}

const prefixes = {
  news: key('news', ''),
  weather: key('weather', ''),
  wiki: key('wiki', ''),
  career: key('career', ''),
  jolpica: key('jolpica', ''),
  api: key('api', ''),
  rateLimit: key('rl', ''),
  username: key('user', 'name', ''),
  presence: key('presence', ''),
};

module.exports = {
  PREFIX,
  prefixes,
  newsPool: () => key('news', 'pool'),
  weather: (raceId, date) => key('weather', raceId, date),
  wiki: (driverId) => key('wiki', driverId),
  career: (externalId) => key('career', externalId),
  jolpica: (url) => key('jolpica', url),
  api: (originalUrl) => key('api', originalUrl),
  rateLimit: (scope) => key('rl', scope),
  username: (userId) => key('user', 'name', userId),
  presence: () => key('presence', 'clients'),
};
