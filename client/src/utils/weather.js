
export const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'
export const FALLBACK_STATUSES = [429, 502, 503, 504]

export const WEATHER_CODES = {
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
}

export function buildOpenMeteoUrl({ latitude, longitude, date }) {
  const url = new URL(OPEN_METEO_URL)
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max',
    timezone: 'auto',
    start_date: date,
    end_date: date,
  }).toString()
  return url.toString()
}

export function normalizeForecast(body, { raceId, date }) {
  const daily = body?.daily || {}
  const index = (daily.time || []).indexOf(date)
  if (index === -1) throw new Error('No forecast for this race date')

  const weatherCode = daily.weather_code?.[index] ?? null
  return {
    raceId,
    date,
    weatherCode,
    weatherLabel: WEATHER_CODES[weatherCode] ?? 'Нет данных',
    temperatureMax: daily.temperature_2m_max?.[index] ?? null,
    temperatureMin: daily.temperature_2m_min?.[index] ?? null,
    precipitationProbability: daily.precipitation_probability_max?.[index] ?? null,
    windSpeedMax: daily.wind_speed_10m_max?.[index] ?? null,
    cached: false,
  }
}

export async function fetchOpenMeteoWeather(
  { raceId, date, latitude, longitude },
  { timeoutMs = 8000, fetchImpl = fetch } = {},
) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(buildOpenMeteoUrl({ latitude, longitude, date }), {
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`)
    return normalizeForecast(await response.json(), { raceId, date })
  } finally {
    clearTimeout(timer)
  }
}
