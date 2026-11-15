const { buildCrudService, parseId } = require('./crudService');
const teamRepository = require('../repositories/teamRepository');
const { Team, SeasonTeam, RaceResult, sequelize } = require('../models');
const { invalidateApiCache } = require('../cache/invalidate');

const baseService = buildCrudService({
  repository: teamRepository,
  resource: 'team',
});

function whitelist(data) {
  return {
    name: data.name,
    principal: data.principal,
    nationality: data.nationality,
    url: data.url,
    color: data.color,
    isActive: data.isActive,
  };
}

function sanitizeTeam(team, season = null) {
  const json = typeof team.toJSON === 'function' ? team.toJSON() : team;
  const { seasonTeams, ...rest } = json;
  const drivers = (seasonTeams || [])
    .slice()
    .sort((a, b) => (a.id || 0) - (b.id || 0))
    .map((st) => st.driver)
    .filter((d) => Boolean(d))
    .map((d) => ({
      id: d.id,
      firstName: d.firstName,
      lastName: d.lastName,
      abbreviation: d.abbreviation,
      number: d.number,
      nationality: d.nationality,
    }));
  return { ...rest, season, drivers };
}

async function currentSeason() {
  return teamRepository.currentSeason();
}

/** Эпик-10: состав команды можно смотреть в конкретном сезоне (?season=YYYY). */
async function resolveSeason(raw) {
  if (raw === undefined || raw === null || raw === '') return currentSeason();
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1950 || value > 2100) {
    const err = new Error('Некорректный сезон: укажите год от 1950 до 2100');
    err.status = 400;
    throw err;
  }
  return value;
}

async function getAll({ includeInactive } = {}) {
  const season = await currentSeason();
  const teams = await teamRepository.findAllWithDetails(season, { includeInactive });
  return teams.map((team) => sanitizeTeam(team, season));
}

async function getById(rawId, rawSeason) {
  const id = parseId(rawId);
  if (id === null) return { error: 'Invalid id' };
  const season = await resolveSeason(rawSeason);
  const team = await teamRepository.findByIdWithDetails(id, season, { includeInactive: true });
  if (!team) return { error: 'Команда не найдена', status: 404 };
  return sanitizeTeam(team, season);
}

async function create(data) {
  const record = await teamRepository.create(whitelist(data));
  await invalidateApiCache();
  const season = await currentSeason();
  const full = await teamRepository.findByIdWithDetails(record.id, season, { includeInactive: true });
  return sanitizeTeam(full || record, season);
}

async function update(rawId, data) {
  const id = parseId(rawId);
  if (id === null) return { error: 'Invalid id' };
  const updated = await teamRepository.update(id, whitelist(data));
  if (!updated) return { error: 'Команда не найдена', status: 404 };
  await invalidateApiCache();
  const season = await currentSeason();
  const full = await teamRepository.findByIdWithDetails(id, season, { includeInactive: true });
  return sanitizeTeam(full, season);
}

async function remove(rawId) {
  const id = parseId(rawId);
  if (id === null) return { error: 'Invalid id' };

  const team = await Team.findByPk(id);
  if (!team) return { error: 'Команда не найдена', status: 404 };

  const results = await RaceResult.count({ where: { teamId: id } });
  if (results > 0) {
    return {
      error:
        'Невозможно удалить команду: у неё есть результаты гран-при. ' +
        'Сначала удалите результаты во вкладке «Результаты» или архивируйте команду.',
      status: 409,
    };
  }

  await sequelize.transaction(async (t) => {
    await SeasonTeam.destroy({ where: { teamId: id }, transaction: t });
    await Team.destroy({ where: { id }, transaction: t });
  });

  await invalidateApiCache();
  return true;
}

module.exports = {
  ...baseService,
  getAll,
  getById,
  create,
  update,
  remove,
  currentSeason,
};