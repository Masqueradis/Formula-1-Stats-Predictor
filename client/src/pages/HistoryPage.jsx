import useDocumentTitle from '../hooks/useDocumentTitle'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../api'
import Card from '../components/ui/Card'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'

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

export default function HistoryPage() {
  useDocumentTitle('История Гран-при')
  const [searchParams, setSearchParams] = useSearchParams()
  const [seasons, setSeasons] = useState([])
  const [season, setSeason] = useState(null)
  const [races, setRaces] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)

  // Сезоны и сезон по умолчанию: последний завершённый, а не текущий
  useEffect(() => {
    let cancelled = false
    api.get('/history/seasons')
      .then(({ data }) => {
        if (cancelled) return
        const list = data.data || []
        setSeasons(list)
        const currentYear = new Date().getFullYear()
        const fallback = list.find((row) => row.season < currentYear)?.season ?? list[0]?.season
        const requested = Number(searchParams.get('season'))
        const exists = list.some((row) => row.season === requested)
        setSeason(exists ? requested : fallback ?? null)
      })
      .catch(() => { if (!cancelled) setIsError(true) })
    return () => { cancelled = true }
  // searchParams намеренно читаем только при монтировании
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!season) return undefined
    let cancelled = false
    setIsLoading(true)
    setIsError(false)
    api.get('/history/races', { params: { season } })
      .then(({ data }) => {
        if (cancelled) return
        setRaces(data.data?.races || [])
      })
      .catch(() => { if (!cancelled) setIsError(true) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [season])

  const changeSeason = (value) => {
    const next = new URLSearchParams(searchParams)
    next.set('season', value)
    setSearchParams(next)
    setSeason(Number(value))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground dark:text-foreground-dark">История Гран-при</h1>
          <p className="mt-1 text-sm text-muted dark:text-muted-dark">
            Полная классификация гонок 2000–2025. Текущий сезон — в{' '}
            <Link to="/calendar" className="font-semibold text-primary underline dark:text-accent">
              календаре
            </Link>
            .
          </p>
        </div>
        {seasons.length > 0 && (
          <Select label="Сезон" value={season ? String(season) : ''} onChange={(e) => changeSeason(e.target.value)}>
            {seasons.map((row) => (
              <option key={row.season} value={String(row.season)}>
                {row.season} · {row.races} гонок
              </option>
            ))}
          </Select>
        )}
      </div>

      {isLoading ? (
        <Spinner label="Загрузка истории…" />
      ) : isError ? (
        <Card className="p-8 text-center text-sm font-medium text-red-500">
          Не удалось загрузить исторические гонки
        </Card>
      ) : races.length === 0 ? (
        <Card className="border-dashed p-8 text-center text-muted dark:text-muted-dark">
          Для этого сезона нет гонок
        </Card>
      ) : (
        <div className="space-y-3">
          {races.map((race) => {
            const status = STATUS[race.status] || STATUS.scheduled
            return (
              <Link key={race.id} to={`/history/races/${race.id}`} className="block">
                <Card className="flex flex-col gap-3 p-4 transition-shadow hover:shadow-lg sm:flex-row sm:items-center sm:p-5">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 dark:bg-accent/10">
                    <span className="text-[10px] font-bold uppercase text-muted dark:text-muted-dark">Этап</span>
                    <span className="text-lg font-black text-primary dark:text-accent">{race.round}</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-bold text-foreground dark:text-foreground-dark">{race.name}</h2>
                    <p className="mt-0.5 truncate text-sm text-muted dark:text-muted-dark">
                      {[race.circuit, race.country].filter(Boolean).join(' · ')}
                    </p>
                    {race.podium.length > 0 && (
                      <p className="mt-1 truncate text-xs text-muted dark:text-muted-dark">
                        Подиум:{' '}
                        {race.podium.map((row, index) => (
                          <span key={`${race.id}-${index}`} className="font-semibold text-foreground dark:text-foreground-dark">
                            {row.driver?.lastName || '—'}
                            {index < race.podium.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-1">
                    <span className="text-sm font-medium text-foreground dark:text-foreground-dark">
                      {formatDate(race.date)}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>
                      {status.label}
                    </span>
                    <span className="text-xs font-semibold text-primary dark:text-accent">Классификация →</span>
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
