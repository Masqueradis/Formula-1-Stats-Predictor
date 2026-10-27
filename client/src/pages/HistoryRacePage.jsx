import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../api'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import useDocumentTitle from '../hooks/useDocumentTitle'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function positionLabel(row) {
  return row.positionText || (row.position == null ? '—' : String(row.position))
}

export default function HistoryRacePage() {
  const { raceId } = useParams()
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [tab, setTab] = useState('race')

  useDocumentTitle(data?.race?.name || 'Гонка')

  const load = useCallback(async () => {
    setTab('race')
    setIsLoading(true)
    setIsError(false)
    try {
      const { data: response } = await api.get(`/history/races/${raceId}`)
      setData(response.data)
    } catch {
      setIsError(true)
    } finally {
      setIsLoading(false)
    }
  }, [raceId])

  useEffect(() => { load() }, [load])

  if (isLoading) return <Spinner label="Загрузка гонки…" />

  if (isError || !data) {
    return (
      <Card className="p-8 text-center">
        <p className="mb-4 text-sm font-medium text-red-500">Не удалось загрузить гонку</p>
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={load}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover dark:bg-accent dark:hover:bg-accent-hover"
          >
            Повторить
          </button>
          <Link
            to="/history"
            className="rounded-lg border border-border-soft px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-background dark:border-border-dark dark:text-foreground-dark dark:hover:bg-background-dark"
          >
            К истории
          </Link>
        </div>
      </Card>
    )
  }

  const { race, results } = data
  const raceRows = results?.race || []
  const sprintRows = results?.sprint || []
  const activeTab = tab === 'sprint' && sprintRows.length > 0 ? 'sprint' : 'race'
  const rows = activeTab === 'sprint' ? sprintRows : raceRows
  const podium = raceRows.filter((row) => row.position >= 1 && row.position <= 3).slice(0, 3)

  const tabClass = (active) =>
    `rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
      active
        ? 'bg-primary text-white dark:bg-accent dark:text-black'
        : 'text-muted hover:text-foreground dark:text-muted-dark dark:hover:text-foreground-dark'
    }`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={`/history?season=${race.season}`}
          className="text-sm font-medium text-muted hover:text-primary dark:text-muted-dark dark:hover:text-accent"
        >
          ← История сезона {race.season}
        </Link>
        <Link
          to={`/standings?season=${race.season}`}
          className="rounded-lg border border-border-soft px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-background dark:border-border-dark dark:text-foreground-dark dark:hover:bg-background-dark"
        >
          Итоги сезона →
        </Link>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground dark:text-foreground-dark">{race.name}</h1>
            <p className="mt-1 text-sm text-muted dark:text-muted-dark">
              Сезон {race.season}, этап {race.round} · {formatDate(race.date)}
            </p>
          </div>
          <p className="text-sm text-muted dark:text-muted-dark">
            {[race.circuit, race.country].filter(Boolean).join(' · ')}
          </p>
        </div>

        {podium.length > 0 && (
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {podium.map((row) => (
              <div key={row.driver.id} className="rounded-lg border border-border-soft p-3 dark:border-border-dark">
                <div className="text-xs font-bold uppercase tracking-wide text-muted dark:text-muted-dark">
                  {row.position === 1 ? 'Победа' : `${row.position}-е место`}
                </div>
                <Link
                  to={`/drivers/${row.driver.id}`}
                  className="mt-1 block font-semibold text-foreground hover:text-primary dark:text-foreground-dark dark:hover:text-accent"
                >
                  {row.driver.firstName} {row.driver.lastName}
                </Link>
                {row.team && (
                  <Link
                    to={`/teams/${row.team.id}?season=${race.season}`}
                    className="text-xs text-muted hover:text-primary dark:text-muted-dark dark:hover:text-accent"
                  >
                    {row.team.name}
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setTab('race')} className={tabClass(activeTab === 'race')}>
          Гонка
        </button>
        {sprintRows.length > 0 && (
          <button type="button" onClick={() => setTab('sprint')} className={tabClass(activeTab === 'sprint')}>
            Спринт
          </button>
        )}
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted dark:text-muted-dark">
            Классификация пока не загружена.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border-soft text-xs uppercase tracking-wide text-muted dark:border-border-dark dark:text-muted-dark">
                  <th className="px-4 py-3 text-left font-semibold">Поз.</th>
                  <th className="px-4 py-3 text-left font-semibold">Пилот</th>
                  <th className="px-4 py-3 text-left font-semibold">Команда</th>
                  <th className="px-4 py-3 text-center font-semibold">Старт</th>
                  <th className="px-4 py-3 text-center font-semibold">Круги</th>
                  <th className="px-4 py-3 text-left font-semibold">Время / статус</th>
                  <th className="px-4 py-3 text-right font-semibold">Очки</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={`${activeTab}-${row.driver.id}`}
                    className="border-b border-border-soft last:border-0 hover:bg-background dark:border-border-dark dark:hover:bg-background-dark"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-foreground dark:text-foreground-dark">
                      {positionLabel(row)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/drivers/${row.driver.id}`}
                        className="font-semibold text-foreground hover:text-primary dark:text-foreground-dark dark:hover:text-accent"
                      >
                        {row.driver.firstName} {row.driver.lastName}
                      </Link>
                      {row.fastestLap && (
                        <span className="ml-2 rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400">
                          FL
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.team ? (
                        <Link
                          to={`/teams/${row.team.id}?season=${race.season}`}
                          className="inline-flex items-center gap-2 text-muted hover:text-primary dark:text-muted-dark dark:hover:text-accent"
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: row.team.color || '#0ea5e9' }}
                            aria-hidden
                          />
                          {row.team.name}
                        </Link>
                      ) : (
                        <span className="text-muted dark:text-muted-dark">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-muted dark:text-muted-dark">{row.grid ?? '—'}</td>
                    <td className="px-4 py-3 text-center text-muted dark:text-muted-dark">{row.laps ?? '—'}</td>
                    <td className="px-4 py-3 text-muted dark:text-muted-dark">
                      {row.time || row.status || '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-foreground dark:text-foreground-dark">
                      {row.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
