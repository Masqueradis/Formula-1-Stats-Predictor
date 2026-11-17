import useDocumentTitle from '../hooks/useDocumentTitle'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import { FALLBACK_STATUSES, fetchOpenMeteoWeather } from '../utils/weather'

const STATUS = {
  finished: { label: 'Завершена', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  scheduled: { label: 'Запланирована', className: 'bg-primary/15 text-primary dark:bg-accent/15 dark:text-accent' },
  cancelled: { label: 'Отменена', className: 'bg-red-500/15 text-red-500' },
}

const WEATHER_HORIZON_DAYS = 16

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function daysUntil(dateValue) {
  if (!dateValue) return null
  const raceDay = new Date(`${String(dateValue).slice(0, 10)}T00:00:00Z`).getTime()
  if (Number.isNaN(raceDay)) return null
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  return Math.round((raceDay - today.getTime()) / 86400000)
}

function WeatherWidget({ race }) {
  const [state, setState] = useState('idle')
  const [weather, setWeather] = useState(null)
  const [error, setError] = useState('')

  const load = async () => {
    setState('loading')
    setError('')
    try {
      const { data } = await api.get(`/races/${race.id}/weather`)
      setWeather(data.data)
      setState('ready')
      return
    } catch (err) {
      const status = err.response?.status
      if (status === 404) {
        setError('Прогноз появится не раньше чем за 16 дней до гонки')
        setState('error')
        return
      }
      if (status === 400) {
        setError('Погода доступна только для запланированных гонок')
        setState('error')
        return
      }
      if (!FALLBACK_STATUSES.includes(status) && status !== undefined) {
        setError('Погода недоступна')
        setState('error')
        return
      }
    }

    try {
      const direct = await fetchOpenMeteoWeather({
        raceId: race.id,
        date: String(race.date).slice(0, 10),
        latitude: race.trackLatitude,
        longitude: race.trackLongitude,
      })
      setWeather(direct)
      setState('ready')
    } catch {
      setError('Погода недоступна')
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
            const showWeather = race.status === 'scheduled' && weatherVisible
            const showWeatherHint = race.status === 'scheduled' && !weatherVisible && days !== null && days > WEATHER_HORIZON_DAYS
            return (
              <Card
                key={race.id}
                className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2 p-4 sm:grid-cols-[3rem_minmax(0,1fr)_10rem_15rem] sm:items-start sm:p-5"
              >
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 dark:bg-accent/10 sm:mt-0.5">
                  <span className="text-[10px] font-bold uppercase text-muted dark:text-muted-dark">Этап</span>
                  <span className="text-lg font-black text-primary dark:text-accent">{race.round}</span>
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-foreground dark:text-foreground-dark">{race.name}</h2>
                  <p className="mt-0.5 truncate text-sm text-muted dark:text-muted-dark">
                    {[race.circuit, race.country].filter(Boolean).join(' · ')}
                  </p>
                </div>

                <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:flex-col sm:items-end sm:justify-start sm:gap-1 sm:pt-1">
                  <span className="whitespace-nowrap text-sm font-medium tabular-nums text-foreground dark:text-foreground-dark">
                    {formatDate(race.date)}
                  </span>
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-2 sm:col-span-1 sm:justify-end sm:pt-1">
                  {showWeather && <WeatherWidget race={race} />}
                  {showWeatherHint && (
                    <span className="text-xs text-muted dark:text-muted-dark sm:text-right">
                      Погода — за {WEATHER_HORIZON_DAYS} дн.
                    </span>
                  )}
                  {race.winner && (
                    <div
                      className="w-full max-w-full rounded-lg border border-border-soft px-3 py-1.5 text-xs dark:border-border-dark sm:w-auto sm:max-w-full sm:overflow-hidden sm:text-ellipsis sm:whitespace-nowrap"
                      title={`Победитель: ${race.winner.firstName} ${race.winner.lastName}`}
                    >
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