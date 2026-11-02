import useDocumentTitle from '../hooks/useDocumentTitle'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../api'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function ResultTable({ rows, season }) {
  if (!rows.length) {
    return <p className="p-6 text-sm text-muted dark:text-muted-dark">Нет данных о результатах.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border-soft text-xs uppercase tracking-wide text-muted dark:border-border-dark dark:text-muted-dark">
            <th className="px-3 py-3 text-left font-semibold">Поз</th>
            <th className="px-3 py-3 text-left font-semibold">Пилот</th>
            <th className="px-3 py-3 text-left font-semibold">Команда</th>
            <th className="px-3 py-3 text-center font-semibold">Старт</th>
            <th className="px-3 py-3 text-center font-semibold">Круги</th>
            <th className="px-3 py-3 text-left font-semibold">Время / статус</th>
            <th className="px-3 py-3 text-right font-semibold">Очки</th>
            <th className="px-3 py-3 text-center font-semibold">FL</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-border-soft last:border-0 hover:bg-background dark:border-border-dark dark:hover:bg-background-dark"
            >
              <td className="px-3 py-2.5 font-black text-foreground dark:text-foreground-dark">
                {row.positionText || row.position || '—'}
              </td>
              <td className="px-3 py-2.5">
                {row.driver ? (
                  <Link
                    to={`/drivers/${row.driver.id}`}
                    className="font-semibold text-foreground hover:text-primary dark:text-foreground-dark dark:hover:text-accent"
                  >
                    {row.driver.firstName} {row.driver.lastName}
                  </Link>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-3 py-2.5">
                {row.team ? (
                  <Link
                    to={`/teams/${row.team.id}${season ? `?season=${season}` : ''}`}
                    className="inline-flex items-center gap-2 text-muted hover:text-primary dark:text-muted-dark dark:hover:text-accent"
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.team.color || '#0ea5e9' }} aria-hidden />
                    {row.team.name}
                  </Link>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-3 py-2.5 text-center text-foreground dark:text-foreground-dark">{row.grid ?? '—'}</td>
              <td className="px-3 py-2.5 text-center text-foreground dark:text-foreground-dark">{row.laps ?? '—'}</td>
              <td className="px-3 py-2.5 text-muted dark:text-muted-dark">
                {row.time || row.status || '—'}
              </td>
              <td className="px-3 py-2.5 text-right font-bold text-foreground dark:text-foreground-dark">
                {row.points ?? 0}
              </td>
              <td className="px-3 py-2.5 text-center text-primary dark:text-accent">{row.fastestLap ? '●' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function HistoryRacePage() {
  const { raceId } = useParams()
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [tab, setTab] = useState('race')
  useDocumentTitle(data ? data.race.name : 'Гонка')

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setIsError(false)
    api.get(`/history/races/${raceId}`)
      .then(({ data: payload }) => {
        if (cancelled) return
        setData(payload.data)
        setTab('race')
      })
      .catch(() => { if (!cancelled) setIsError(true) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [raceId])

  if (isLoading) return <Spinner label="Загрузка классификации…" />

  if (isError || !data) {
    return (
      <Card className="p-8 text-center">
        <p className="mb-4 text-sm font-medium text-red-500">Не удалось загрузить гонку</p>
        <Link to="/history" className="text-sm font-semibold text-primary underline dark:text-accent">
          ← К истории
        </Link>
      </Card>
    )
  }

  const { race, results } = data
  const hasSprint = (results.sprint || []).length > 0
  const rows = tab === 'sprint' ? results.sprint : results.race

  const tabClass = (active) =>
    `rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
      active
        ? 'bg-primary text-white dark:bg-accent dark:text-black'
        : 'text-muted hover:text-foreground dark:text-muted-dark dark:hover:text-foreground-dark'
    }`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to={`/history?season=${race.season}`}
          className="text-sm font-medium text-muted hover:text-primary dark:text-muted-dark dark:hover:text-accent"
        >
          ← История сезона {race.season}
        </Link>
        <Link to="/calendar" className="text-sm font-medium text-muted hover:text-primary dark:text-muted-dark dark:hover:text-accent">
          Календарь текущего сезона →
        </Link>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-bold text-foreground dark:text-foreground-dark">{race.name}</h1>
          <span className="text-sm text-muted dark:text-muted-dark">
            Сезон {race.season}, этап {race.round} · {formatDate(race.date)}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted dark:text-muted-dark">
          {[race.circuit, race.country].filter(Boolean).join(' · ')}
        </p>
      </Card>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setTab('race')} className={tabClass(tab === 'race')}>
          Гонка
        </button>
        {hasSprint && (
          <button type="button" onClick={() => setTab('sprint')} className={tabClass(tab === 'sprint')}>
            Спринт
          </button>
        )}
      </div>

      <Card className="overflow-hidden">
        <ResultTable rows={rows} season={race.season} />
      </Card>
    </div>
  )
}
