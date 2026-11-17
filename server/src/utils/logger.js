'use strict';

function logEvent(level, event, fields = {}) {
  const line = JSON.stringify({
    level,
    event,
    ...fields,
    ts: new Date().toISOString(),
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

module.exports = {
  logEvent,
  info: (event, fields) => logEvent('info', event, fields),
  warn: (event, fields) => logEvent('warn', event, fields),
  error: (event, fields) => logEvent('error', event, fields),
};
