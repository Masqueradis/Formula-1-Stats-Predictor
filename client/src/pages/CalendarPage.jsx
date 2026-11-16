import useDocumentTitle from '../hooks/useDocumentTitle'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'

const STATUS = {
  finished: { label: 'Завершена', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  scheduled: { label: 'Запланирована', className: 'bg-primary/15 text-primary dark:bg-accent/15 dark:text-accent' },
  cancelled: { label: 'Отменена', className: 'bg-red-500/15 text-red-500' },
}

// Open-Meteo отдаёт прогноз максимум на 16 дней вперёд — то же окно, что и на бэкенде.
const WEATHER_HORIZON_DAYS = 16

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Сколько дней осталось до гонки (UTC-дни, как в weatherService). null — дата неизвестна. */
function daysUntil(dateValue) {
  if (!dateValue) return null
  const raceDay = new Date(`${String(dateValue).slice(0, 10)}T00:00:00Z`).getTime()
  if (Number.isNaN(raceDay)) return null
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  return Math.round((raceDay - today.getTime()) / 86400000)
}

/**
 * Погода на уик-энд ГП (эпик-09, P2): ленивая загрузка по клику —
 * бэкенд ходит в Open-Meteo и кэширует ответ на 30 минут.
 */
function WeatherWidget({ raceId }) {
  const [state, setState] = useState('idle') // idle | loading | ready | error
  const [weather, setWeather] = useState(null)
  const [error, setError] = useState('')

  const load = async () => {
    setState('loading')
    setError('')
    try {
      const { data } = await api.get(`/races/${raceId}/weather`)
      setWeather(data.data)
      setState('ready')
    } catch (err) {
      const status = err.response?.status
      if (status === 404) setError('Прогноз появится не раньше чем за 16 дней до гонки')
      else if (status === 400) setError('Погода доступна только для запланированных гонок')
      else setError('Погода недоступна')
      setState('error')
    }
  }

  if (state === 'idle') {
    return (
      <button
        type="button"
        onClick={load}
        className="rounded-lg border border-border-soft px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-primary hover:text-primary dark:border-border-dark dark:hover:border-accent dark:hover:text-accent"
      >
        Погода
      </button>
    )
  }

  if (state === 'loading') {
    return <span className="px-1 text-xs text-muted dark:text-muted-dark">Загрузка погоды…</span>
  }

  if (state === 'error') {
    return (
      <div className="flex items-center gap-2 text-xs text-muted dark:text-muted-dark">
        <span>{error}</span>
        <button
          type="button"
          onClick={load}
          className="font-semibold text-primary underline dark:text-accent"
        >
          Ещё раз
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border-soft px-3 py-2 text-xs dark:border-border-dark">
      <span className="font-bold text-foreground dark:text-foreground-dark">
        {weather.weatherLabel}
      </span>
      <span className="mx-2 text-muted dark:text-muted-dark">
        {weather.temperatureMin}…{weather.temperatureMax} °C
      </span>
      <span className="text-muted dark:text-muted-dark">
        Осадки {weather.precipitationProbability ?? '—'}%
        {' · '}
        Ветер {weather.windSpeedMax ?? '—'} км/ч
      </span>
    </div>
  )
}

export default function CalendarPage() {
  useDocumentTitle('Календарь')
  const [races, setRaces] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setIsError(false)
    try {
      const { data } = await api.get('/races', { params: { season: 'current' } })
      const sorted = [...(data.data || [])].sort((a, b) => (a.round - b.round))
      setRaces(sorted)
    } catch {
      setIsError(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (isLoading) return <Spinner label="Загрузка календаря…" />

  if (isError) {
    return (
      <Card className="p-8 text-center">
        <p className="mb-4 text-sm font-medium text-red-500">Не удалось загрузить календарь</p>
        <button
          type="button"
          onClick={load}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover dark:bg-accent dark:hover:bg-accent-hover"
        >
          Повторить
        </button>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground dark:text-foreground-dark">Календарь Гран-при</h1>
        <Link
          to="/history"
          className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20 dark:bg-accent/10 dark:text-accent dark:hover:bg-accent/20"
        >
          История 2000–2025 →
        </Link>
      </div>

      {races.length === 0 ? (
        <Card className="border-dashed p-8 text-center text-muted dark:text-muted-dark">Нет гонок</Card>
      ) : (
        <div className="space-y-3">
          {races.map((race) => {
            const status = STATUS[race.status] || STATUS.scheduled
            const days = daysUntil(race.date)
            const weatherVisible = days !== null && days <= WEATHER_HORIZON_DAYS
            const weatherHint = days !== null && days > WEATHER_HORIZON_DAYS
              ? `Прогноз погоды появится за ${WEATHER_HORIZON_DAYS} дней до гонки`
              : 'Дата гонки не указана — прогноз погоды недоступен'
            return (
              <Card
                key={race.id}
                className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 p-4 sm:grid-cols-[3rem_minmax(0,1fr)_10rem_11rem] sm:p-5"
              >
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 dark:bg-accent/10">
                  <span className="text-[10px] font-bold uppercase text-muted dark:text-muted-dark">Этап</span>
                  <span className="text-lg font-black text-primary dark:text-accent">{race.round}</span>
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-foreground dark:text-foreground-dark">{race.name}</h2>
                  <p className="mt-0.5 truncate text-sm text-muted dark:text-muted-dark">
                    {[race.circuit, race.country].filter(Boolean).join(' · ')}
                  </p>
                  {race.status === 'scheduled' && (
                    <div className="mt-2">
                      {weatherVisible ? (
                        <WeatherWidget raceId={race.id} />
                      ) : (
                        <span className="text-xs text-muted dark:text-muted-dark">{weatherHint}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:flex-col sm:items-end sm:justify-center sm:gap-1">
                  <span className="whitespace-nowrap text-sm font-medium tabular-nums text-foreground dark:text-foreground-dark">
                    {formatDate(race.date)}
                  </span>
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1 sm:flex-col sm:items-end">
                  {race.winner && (
                    <div className="min-w-0 max-w-full truncate rounded-lg border border-border-soft px-3 py-1.5 text-xs dark:border-border-dark">
                      <span className="text-muted dark:text-muted-dark">Победитель: </span>
                      <span className="font-bold text-foreground dark:text-foreground-dark">
                        {race.winner.firstName} {race.winner.lastName}
                      </span>
                    </div>
                  )}
                  {race.broadcastUrl && (
                    <a
                      href={race.broadcastUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="whitespace-nowrap rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20 dark:bg-accent/10 dark:text-accent dark:hover:bg-accent/20"
                    >
                      Смотреть трансляцию
                    </a>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}