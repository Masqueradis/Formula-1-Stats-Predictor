'use strict';

const raceRepository = require('../repositories/raceRepository');
const logger = require('../utils/logger');

/**
 * Погода на уик-энд Гран-при (эпик-09, P2): проксируем Open-Meteo
 * (бесплатный, без API-ключа) по координатам трассы из races.
 */

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const FETCH_TIMEOUT_MS = 8000;
// Open-Meteo отдаёт прогноз максимум на 16 дней вперёд
const FORECAST_HORIZON_DAYS = 16;
const CACHE_TTL_MS = 30 * 60 * 1000;

// WMO weather interpretation codes → человекочитаемое описание
const WEATHER_CODES = {
  0: 'Ясно',
  1: 'Малооблачно',
  2: 'Переменная облачность',
  3: 'Пасмурно',
  45: 'Туман',
  48: 'Изморозь, туман',
  51: 'Лёгкая морось',
  53: 'Морось',
  55: 'Сильная морось',
  56: 'Ледяная морось',
  57: 'Сильная ледяная морось',
  61: 'Лёгкий дождь',
  63: 'Дождь',
  65: 'Сильный дождь',
  66: 'Ледяной дождь',
  67: 'Сильный ледяной дождь',
  71: 'Лёгкий снег',
  73: 'Снег',
  75: 'Сильный снег',
  77: 'Снежные зёрна',
  80: 'Лёгкий ливень',
  81: 'Ливень',
  82: 'Сильный ливень',
  85: 'Снежный заряд',
  86: 'Сильный снежный заряд',
  95: 'Гроза',
  96: 'Гроза с градом',
  99: 'Сильная гроза с градом',
};

// Ключ → { date } — погода «на дату гонки», обновляется не чаще раза в 30 мин
const cache = new Map();

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function forecastOutOfRange(race) {
  const raceDay = new Date(`${race.date}T00:00:00Z`).getTime();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const diffDays = Math.round((raceDay - today.getTime()) / 86400000);
  return diffDays > FORECAST_HORIZON_DAYS;
}

async function fetchForecast(latitude, longitude, date) {
  const url = new URL(OPEN_METEO_URL);
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max',
    timezone: 'auto',
    start_date: date,
    end_date: date,
  }).toString();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'F1StatsPredictor/1.0' },
    });
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    const body = await res.json();
    const daily = body.daily || {};
    // API вернул диапазон без искомой даты (редкий случай — отдаём null'ы)
    const index = (daily.time || []).indexOf(date);
    if (index === -1) return null;
    return {
      weatherCode: daily.weather_code?.[index] ?? null,
      temperatureMax: daily.temperature_2m_max?.[index] ?? null,
      temperatureMin: daily.temperature_2m_min?.[index] ?? null,
      precipitationProbability: daily.precipitation_probability_max?.[index] ?? null,
      windSpeedMax: daily.wind_speed_10m_max?.[index] ?? null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function getRaceWeather(rawRaceId) {
  const id = Number.parseInt(rawRaceId, 10);
  if (Number.isNaN(id)) return { error: 'Invalid id' };

  const race = await raceRepository.findById(id);
  if (!race) return { error: 'Race not found', status: 404 };
  if (race.status !== 'scheduled' || !race.date) {
    throw httpError(400, 'Weather is only available for scheduled races');
  }
  if (race.trackLatitude == null || race.trackLongitude == null) {
    throw httpError(400, 'Race has no track coordinates');
  }
  if (forecastOutOfRange(race)) {
    throw httpError(404, 'Forecast is not available this far ahead (Open-Meteo covers 16 days)');
  }

  const cacheKey = `${id}:${race.date}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { ...cached.data, cached: true };
  }

  let forecast;
  try {
    forecast = await fetchForecast(race.trackLatitude, race.trackLongitude, race.date);
  } catch (err) {
    // Сеть/апстрим лёг — отдаём 502, фронт покажет «погода недоступна»
    logger.warn('weather.fetch_failed', { raceId: id, reason: err.message });
    throw httpError(502, 'Weather service is unavailable');
  }

  if (!forecast) {
    throw httpError(404, 'No forecast for this race date');
  }

  const data = {
    raceId: id,
    date: race.date,
    weatherCode: forecast.weatherCode,
    weatherLabel: WEATHER_CODES[forecast.weatherCode] ?? 'Нет данных',
    temperatureMax: forecast.temperatureMax,
    temperatureMin: forecast.temperatureMin,
    precipitationProbability: forecast.precipitationProbability,
    windSpeedMax: forecast.windSpeedMax,
    cached: false,
  };

  cache.set(cacheKey, { data, fetchedAt: Date.now() });
  logger.info('weather.fetched', { raceId: id, date: race.date, weatherCode: forecast.weatherCode });
  return data;
}

module.exports = { getRaceWeather };
