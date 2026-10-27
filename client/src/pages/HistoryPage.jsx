import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../api'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import useDocumentTitle from '../hooks/useDocumentTitle'

const STATUS = {
  finished: { label: 'Завершена', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  scheduled: { label: 'Запланирована', className: 'bg-primary/15 text-primary dark:bg-accent/15 dark:text-accent' },
  cancelled: { label: 'Отменена', className: 'bg-red-500/15 text-red-500' },
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function Podium({ rows }) {
  if (!rows?.length) {
    return <p className="text-sm text-muted dark:text-muted-dark">Результаты ещё не загружены</p>
  }
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {rows.map((row, index) => (
        <span key={`${row.driver?.id}-${row.position}`} className="inline-flex items-center gap-1">
          <span className="font-mono text-xs font-bold text-muted dark:text-muted-dark">{index + 1}.</span>
          <span className="font-semibold text-foreground dark:text-foreground-dark">
            {row.driver?.firstName} {row.driver?.lastName}
          </span>
          {row.team && (
            <span className="text-xs text-muted dark:text-muted-dark">{row.team.name}</span>
          )}
        </span>
      ))}
    </div>
  )
}

export default function HistoryPage() {
  useDocumentTitle('История Гран-при')
  const [searchParams, setSearchParams] = useSearchParams()
  const [seasons, setSeasons] = useState([])
  const [races, setRaces] = useState([])
  const [isLoadingSeasons, setIsLoadingSeasons] = useState(true)
  const [isLoadingRaces, setIsLoadingRaces] = useState(false)
  const [error, setError] = useState('')

  // По умолчанию открываем последний завершённый сезон, а не текущий:
  // текущий календарь уже есть на отдельной вкладке.
  const currentYear = new Date().getFullYear()
  const defaultSeason =
    seasons.find((item) => item.season < currentYear)?.season ?? seasons[0]?.season
  const season = searchParams.get('season') || (defaultSeason ? String(defaultSeason) : '')

  const loadSeasons = useCallback(async () => {
    setIsLoadingSeasons(true)
    setError('')
    try {
      const { data } = await api.get('/history/seasons')
      setSeasons(data.data || [])
    } catch {
      setError('Не удалось загрузить список сезонов')
    } finally {
      setIsLoadingSeasons(false)
    }
  }, [])

  const loadRaces = useCallback(async (value) => {
    if (!value) return
    setIsLoadingRaces(true)
    setError('')
    try {
      const { data } = await api.get('/history/races', { params: { season: value } })
      setRaces(data.data?.races || [])
    } catch {
      setError('Не удалось загрузить гонки сезона')
      setRaces([])
    } finally {
      setIsLoadingRaces(false)
    }
  }, [])

  useEffect(() => { loadSeasons() }, [loadSeasons])

  useEffect(() => {
    if (season) loadRaces(season)
    else setRaces([])
  }, [season, loadRaces])

  const changeSeason = (event) => {
    const next = new URLSearchParams(searchParams)
    next.set('season', event.target.value)
    setSearchParams(next)
  }

  if (isLoadingSeasons) return <Spinner label="Загрузка истории…" />

  if (error && seasons.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="mb-4 text-sm font-medium text-red-500">{error}</p>
        <button
          type="button"
          onClick={loadSeasons}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover dark:bg-accent dark:hover:bg-accent-hover"
        >
          Повторить
        </button>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground dark:text-foreground-dark">История Гран-при</h1>
          <p className="mt-1 text-sm text-muted dark:text-muted-dark">
            Полные результаты прошлых сезонов: подиумы, классификация и спринты.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted dark:text-muted-dark">
            Сезон
            <select
              value={season}
              onChange={changeSeason}
              className="rounded-lg border border-border-soft bg-card px-3 py-2 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark dark:focus:border-accent"
            >
              {seasons.map((item) => (
                <option key={item.season} value={item.season}>
                  {item.season} · {item.races} гонок
                </option>
              ))}
            </select>
          </label>
          {season && (
            <Link
              to={`/standings?season=${season}`}
              className="rounded-lg border border-border-soft px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-background dark:border-border-dark dark:text-foreground-dark dark:hover:bg-background-dark"
            >
              Итоги сезона →
            </Link>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-500">{error}</p>
      )}

      {isLoadingRaces ? (
        <Spinner label="Загрузка гонок…" />
      ) : races.length === 0 ? (
        <Card className="border-dashed p-8 text-center text-muted dark:text-muted-dark">
          Для сезона {season || '—'} нет синхронизированных гонок.
        </Card>
      ) : (
        <div className="space-y-3">
          {races.map((race) => {
            const status = STATUS[race.status] || STATUS.scheduled
            const winner = race.winner
            return (
              <Link key={race.id} to={`/history/races/${race.id}`} className="block">
                <Card className="p-4 transition-colors hover:border-primary dark:hover:border-accent sm:p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 dark:bg-accent/10">
                      <span className="text-[10px] font-bold uppercase text-muted dark:text-muted-dark">Этап</span>
                      <span className="text-lg font-black text-primary dark:text-accent">{race.round}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <h2 className="text-lg font-bold text-foreground dark:text-foreground-dark">{race.name}</h2>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted dark:text-muted-dark">
                        {[race.circuit, race.country].filter(Boolean).join(' · ')}
                      </p>
                      <div className="mt-2">
                        <Podium rows={race.podium} />
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-start gap-1 text-sm text-muted dark:text-muted-dark lg:items-end">
                      <span>{formatDate(race.date)}</span>
                      {winner && (
                        <span>
                          Победитель:{' '}
                          <span className="font-semibold text-foreground dark:text-foreground-dark">
                            {winner.firstName} {winner.lastName}
                          </span>
                        </span>
                      )}
                      <span className="text-xs font-semibold text-primary dark:text-accent">Открыть классификацию →</span>
                    </div>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
