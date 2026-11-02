'use strict';

/**
 * Карьерная статистика пилота (эпик-09, P4).
 *
 * Историю берём из Jolpica/Ergast: `/drivers/{id}/results.json` отдаёт ВСЕ
 * результаты карьеры постранично (по 100), из них считаем старты, победы,
 * подиумы, поулы, быстрые круги, очки, сходы и разбивку по сезонам.
 * Если у пилота нет externalId или Jolpica недоступна — считаем по локальной
 * таблице race_results (то, что синхронизировано в БД), источник помечаем.
 */

const jolpicaClient = require('../clients/jolpicaClient');
const { Driver, Race, RaceResult } = require('../models');
const { parseId } = require('./crudService');

const PAGE_LIMIT = 100;
const MAX_PAGES = 10;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const cache = new Map();

function emptySeason(season) {
  return { season, starts: 0, wins: 0, podiums: 0, points: 0 };
}

/**
 * Единая агрегация: элементы — результаты в форме Ergast
 * ({ position, positionText, points, grid, FastestLap, season }).
 */
function aggregate(results) {
  const seasons = new Map();
  const totals = {
    starts: 0,
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    dnfs: 0,
    bestFinish: null,
    firstSeason: null,
    lastSeason: null,
    seasons: [],
  };

  for (const result of results) {
    const season = Number(result.season) || null;
    if (!season) continue;

    const position = Number(result.position) || null;
    const points = Number(result.points) || 0;
    const positionText = String(result.positionText ?? '');

    const seasonEntry = seasons.get(season) || emptySeason(season);
    seasonEntry.starts += 1;
    seasonEntry.points += points;

    totals.starts += 1;
    totals.points += points;

    if (position === 1) {
      totals.wins += 1;
      seasonEntry.wins += 1;
    }
    if (position && position <= 3) {
      totals.podiums += 1;
      seasonEntry.podiums += 1;
    }
    if (String(result.grid) === '1') totals.poles += 1;
    if (String(result.FastestLap?.rank) === '1') totals.fastestLaps += 1;

    // Ergast: R — сошёл, D — дисквалифицирован, E — исключён, W — снят
    if (['R', 'D', 'E', 'W'].includes(positionText)) totals.dnfs += 1;
    if (position && (totals.bestFinish === null || position < totals.bestFinish)) {
      totals.bestFinish = position;
    }

    if (totals.firstSeason === null || season < totals.firstSeason) totals.firstSeason = season;
    if (totals.lastSeason === null || season > totals.lastSeason) totals.lastSeason = season;

    seasons.set(season, seasonEntry);
  }

  totals.points = Math.round(totals.points * 10) / 10;
  totals.seasons = [...seasons.values()]
    .map((entry) => ({ ...entry, points: Math.round(entry.points * 10) / 10 }))
    .sort((a, b) => b.season - a.season);

  return totals;
}

async function fetchRemoteResults(externalId) {
  const base = `/drivers/${encodeURIComponent(externalId)}/results.json?limit=${PAGE_LIMIT}`;
  const first = await jolpicaClient.getJson(`${base}&offset=0`, { ttl: CACHE_TTL_MS });
  const total = Number(first?.MRData?.total) || 0;
  const pages = Math.min(Math.ceil(total / PAGE_LIMIT), MAX_PAGES);

  const races = [...(first?.MRData?.RaceTable?.Races || [])];
  for (let page = 1; page < pages; page += 1) {
    const next = await jolpicaClient.getJson(`${base}&offset=${page * PAGE_LIMIT}`, { ttl: CACHE_TTL_MS });
    races.push(...(next?.MRData?.RaceTable?.Races || []));
  }

  return races.flatMap((race) =>
    (race.Results || []).map((result) => ({ ...result, season: race.season })),
  );
}

async function fetchLocalResults(driverId) {
  const rows = await RaceResult.findAll({
    where: { driverId, sessionType: 'race' },
    include: [{ model: Race, as: 'race', attributes: ['season'] }],
    order: [['id', 'ASC']],
  });

  return rows.map((row) => ({
    season: row.race?.season,
    position: row.position == null ? null : String(row.position),
    positionText: row.position == null ? 'R' : String(row.position),
    points: row.points,
    grid: row.grid,
    FastestLap: { rank: row.fastestLap ? '1' : '0' },
  }));
}

async function getCareer(rawId) {
  const driverId = parseId(rawId);
  if (driverId === null) return { error: 'Invalid id', status: 400 };

  const driver = await Driver.findByPk(driverId);
  if (!driver) return { error: 'driver not found', status: 404 };

  const cached = driver.externalId ? cache.get(driver.externalId) : null;
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.payload, cached: true };
  }

  let source = 'local';
  let results = [];
  let fallbackReason = null;

  try {
    results = await fetchLocalResults(driver.id);
  } catch (err) {
    fallbackReason = `local: ${err.message}`;
  }

  if (driver.externalId) {
    try {
      const remote = await fetchRemoteResults(driver.externalId);
      if (remote.length) {
        results = remote;
        source = 'jolpica';
        fallbackReason = null;
      }
    } catch (err) {
      fallbackReason = `jolpica: ${err.message}`;
    }
  }

  const payload = {
    driverId: driver.id,
    externalId: driver.externalId,
    source,
    career: aggregate(results),
    ...(fallbackReason ? { fallbackReason } : {}),
    cached: false,
  };

  if (source === 'jolpica') {
    cache.set(driver.externalId, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  return payload;
}

module.exports = { getCareer, aggregate };

module.exports.__resetCache = () => cache.clear();
