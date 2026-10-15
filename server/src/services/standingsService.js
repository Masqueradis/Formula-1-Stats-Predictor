const { RaceResult, Race, SeasonTeam, Driver, Team } = require('../models');

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function normalizeSeason(rawSeason) {
  let season = Number(rawSeason);
  if (!Number.isInteger(season) || season <= 0) {
    const max = await SeasonTeam.max('season');
    season = max || 2026;
  }
  return season;
}

async function getDriversStandings(season) {
  const seasonTeams = await SeasonTeam.findAll({
    where: { season },
    include: [
      { association: 'team', attributes: ['id', 'name', 'color', 'isActive'] },
      { association: 'driver', attributes: ['id', 'firstName', 'lastName', 'abbreviation', 'isActive'] },
    ],
    order: [['id', 'ASC']],
  });

  const byDriver = new Map();
  const teamByDriver = new Map();

  for (const st of seasonTeams) {
    if (st.team && st.team.isActive !== false) teamByDriver.set(st.driverId, st.team);
    const driver = st.driver;
    if (!driver || driver.isActive === false || byDriver.has(driver.id)) continue;
    byDriver.set(driver.id, {
      id: driver.id,
      firstName: driver.firstName,
      lastName: driver.lastName,
      abbreviation: driver.abbreviation,
      wins: 0,
      podiums: 0,
      points: 0,
    });
  }

  const rows = await RaceResult.findAll({
    where: { '$race.season$': season },
    include: [
      { model: Race, as: 'race', attributes: ['id', 'season'] },
      { model: Driver, as: 'driver' },
    ],
  });

  for (const row of rows) {
    const driver = row.driver;
    if (!driver || driver.isActive === false) continue;
    const entry = byDriver.get(driver.id) || {
      id: driver.id,
      firstName: driver.firstName,
      lastName: driver.lastName,
      abbreviation: driver.abbreviation,
      wins: 0,
      podiums: 0,
      points: 0,
    };
    entry.points += toNumber(row.points);
    if (row.sessionType === 'race') {
      if (row.position === 1) entry.wins += 1;
      if (row.position <= 3) entry.podiums += 1;
    }
    byDriver.set(driver.id, entry);
  }

  return {
    season,
    standings: [...byDriver.values()]
      .map((entry) => ({
        ...entry,
        team: teamByDriver.get(entry.id) || null,
      }))
      .sort((a, b) => b.points - a.points || b.wins - a.wins || a.lastName.localeCompare(b.lastName)),
  };
}

async function getConstructorsStandings(season) {
  const seasonTeams = await SeasonTeam.findAll({
    where: { season },
    include: [{ association: 'team', attributes: ['id', 'name', 'color', 'isActive'] }],
  });

  const byTeam = new Map();
  for (const st of seasonTeams) {
    if (!st.team || st.team.isActive === false || byTeam.has(st.team.id)) continue;
    byTeam.set(st.team.id, {
      id: st.team.id,
      name: st.team.name,
      color: st.team.color,
      wins: 0,
      podiums: 0,
      points: 0,
    });
  }

  const rows = await RaceResult.findAll({
    where: { '$race.season$': season },
    include: [{ model: Race, as: 'race', attributes: ['id', 'season'] }],
  });

  for (const row of rows) {
    if (!row.teamId) continue;
    let entry = byTeam.get(row.teamId);
    if (!entry) {
      const team = await Team.findByPk(row.teamId, { attributes: ['id', 'name', 'color', 'isActive'] });
      if (!team || team.isActive === false) continue;
      entry = { id: team.id, name: team.name, color: team.color, wins: 0, podiums: 0, points: 0 };
      byTeam.set(team.id, entry);
    }
    entry.points += toNumber(row.points);
    if (row.sessionType === 'race') {
      if (row.position === 1) entry.wins += 1;
      if (row.position <= 3) entry.podiums += 1;
    }
  }

  return {
    season,
    standings: [...byTeam.values()].sort(
      (a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name),
    ),
  };
}

async function getStandings(rawSeason, rawType) {
  const season = await normalizeSeason(rawSeason);
  const type = rawType === 'constructors' ? 'constructors' : 'drivers';
  if (type === 'constructors') {
    return { ...(await getConstructorsStandings(season)), type };
  }
  return { ...(await getDriversStandings(season)), type };
}

module.exports = { getStandings };