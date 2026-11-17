'use strict';

const { toRussianNationality } = require('./nationalities');

function toPlain(record) {
  if (record == null) return record;
  if (typeof record.toJSON === 'function') return record.toJSON();
  return record;
}

function pickCurrentSeasonTeam(seasonTeams) {
  const rows = Array.isArray(seasonTeams)
    ? seasonTeams.filter(Boolean)
    : seasonTeams
      ? [seasonTeams]
      : [];

  const sorted = [...rows].sort((a, b) => {
    const seasonDiff = (Number(b.season) || 0) - (Number(a.season) || 0);
    if (seasonDiff !== 0) return seasonDiff;
    const reserveDiff = Number(a.isReserve === true) - Number(b.isReserve === true);
    if (reserveDiff !== 0) return reserveDiff;
    return (Number(a.id) || 0) - (Number(b.id) || 0);
  });

  return sorted[0] || null;
}

function sanitizeDriver(record, { currentSeason = null } = {}) {
  const json = toPlain(record);
  if (!json || typeof json !== 'object') return json;
  const { seasonTeams, ...rest } = json;

  let team = null;
  let teamSeason = null;
  const latest = pickCurrentSeasonTeam(seasonTeams);
  if (latest) {
    team = latest.team || null;
    teamSeason = latest.season ?? null;
  }

  if (team) {
    team = { id: team.id, name: team.name, color: team.color };
  }

  const isCurrentSeason = currentSeason == null || teamSeason == null
    ? null
    : Number(teamSeason) === Number(currentSeason);

  return {
    ...rest,
    nationalityRu: toRussianNationality(rest.nationality),
    team,
    teamSeason,
    isCurrentSeason,
  };
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

module.exports = { toPlain, pickCurrentSeasonTeam, sanitizeDriver, sanitizeRace, cleanArray };
