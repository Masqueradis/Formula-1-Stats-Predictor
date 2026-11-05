'use strict';

function toPlain(record) {
  if (record == null) return record;
  if (typeof record.toJSON === 'function') return record.toJSON();
  return record;
}

function sanitizeDriver(record) {
  const json = toPlain(record);
  if (!json || typeof json !== 'object') return json;
  const { seasonTeams, ...rest } = json;

  let team = null;
  let teamSeason = null;
  if (Array.isArray(seasonTeams) && seasonTeams.length) {
    const last = seasonTeams[seasonTeams.length - 1];
    team = last.team || null;
    teamSeason = last.season ?? null;
  } else if (seasonTeams && seasonTeams.team) {
    team = seasonTeams.team;
    teamSeason = seasonTeams.season ?? null;
  }

  if (team) {
    team = { id: team.id, name: team.name, color: team.color };
  }

  return { ...rest, team, teamSeason };
}

function sanitizeRace(record) {
  const json = toPlain(record);
  if (!json || typeof json !== 'object') return json;
  const { results, ...rest } = json;
  const raceOnly = (results || []).filter((r) => (r.sessionType || 'race') === 'race');
  const sorted = [...raceOnly].sort((a, b) => (a.position || 0) - (b.position || 0));
  const winner = sorted.find((r) => r.position === 1) || null;
  const topThree = sorted.slice(0, 3).map((r) => {
    const driver = r.driver || {};
    return {
      position: r.position,
      driver: { id: driver.id, firstName: driver.firstName, lastName: driver.lastName, abbreviation: driver.abbreviation },
    };
  });
  return { ...rest, winner: winner && winner.driver ? topThree[0].driver : null, results: topThree };
}

function cleanArray(items, sanitizer) {
  if (!Array.isArray(items)) return items;
  return items.map((item) => (sanitizer ? sanitizer(item) : toPlain(item)));
}

module.exports = { toPlain, sanitizeDriver, sanitizeRace, cleanArray };
