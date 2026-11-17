import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FALLBACK_STATUSES,
  buildOpenMeteoUrl,
  fetchOpenMeteoWeather,
  normalizeForecast,
} from '../src/utils/weather.js'

const RACE = { raceId: 21, date: '2026-11-22', latitude: 36.1147, longitude: -115.173 }

const BODY = {
  daily: {
    time: ['2026-11-22'],
    weather_code: [3],
    temperature_2m_max: [16.3],
    temperature_2m_min: [10],
    precipitation_probability_max: [5],
    wind_speed_10m_max: [18.2],
  },
}

test('прямой запрос использует координаты и дату гонки', () => {
  const url = new URL(buildOpenMeteoUrl(RACE))
  assert.equal(url.origin + url.pathname, 'https://api.open-meteo.com/v1/forecast')
  assert.equal(url.searchParams.get('latitude'), '36.1147')
  assert.equal(url.searchParams.get('longitude'), '-115.173')
  assert.equal(url.searchParams.get('start_date'), '2026-11-22')
  assert.equal(url.searchParams.get('end_date'), '2026-11-22')
})

test('WMO-код переводится в описание, поля совпадают с бэкендом', () => {
  const result = normalizeForecast(BODY, { raceId: 21, date: '2026-11-22' })
  assert.deepEqual(result, {
    raceId: 21,
    date: '2026-11-22',
    weatherCode: 3,
    weatherLabel: 'Пасмурно',
    temperatureMax: 16.3,
    temperatureMin: 10,
    precipitationProbability: 5,
    windSpeedMax: 18.2,
    cached: false,
  })
})

test('фолбэк поднимается на 429/502/503/504', () => {
  assert.deepEqual(FALLBACK_STATUSES, [429, 502, 503, 504])
})

test('fetchOpenMeteoWeather возвращает нормализованный прогноз', async () => {
  let requestedUrl = ''
  const result = await fetchOpenMeteoWeather(RACE, {
    fetchImpl: async (url) => {
      requestedUrl = url
      return { ok: true, json: async () => BODY }
    },
  })
  assert.equal(result.weatherLabel, 'Пасмурно')
  assert.match(requestedUrl, /start_date=2026-11-22/)
})

test('нет прогноза на дату гонки — ошибка', async () => {
  await assert.rejects(
    fetchOpenMeteoWeather(RACE, {
      fetchImpl: async () => ({ ok: true, json: async () => ({ daily: { time: [] } }) }),
    }),
    /No forecast for this race date/,
  )
})
