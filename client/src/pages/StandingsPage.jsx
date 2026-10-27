import useDocumentTitle from '../hooks/useDocumentTitle'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../api'
import { useSocket } from '../context/SocketContext'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'

const NUMERIC_KEYS = ['wins', 'podiums', 'points']

function valueFor(row, key) {
  if (key === 'driver') return `${row.lastName || ''} ${row.firstName || ''}`.toLowerCase()
  if (key === 'team') return (row.name || '').toLowerCase()
  return Number(row[key]) || 0
}

function SortHeader({ label, sortKey, sort, onSort, align = 'left' }) {
  const active = sort.key === sortKey
  const arrow = active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return (
    <th className={`px-4 py-3 font-semibold ${alignClass}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-primary dark:hover:text-accent ${
          active ? 'text-primary dark:text-accent' : ''
        }`}
      >
        {label}
        <span className="text-[10px]">{arrow}</span>
      </button>
    </th>
  )
}

export default function StandingsPage() {
  useDocumentTitle('Турнирная таблица')
  const { subscribe } = useSocket()
  const [searchParams, setSearchParams] = useSearchParams()
  const type = searchParams.get('type') === 'constructors' ? 'constructors' : 'drivers'
  const season = searchParams.get('season') || ''
  const [seasons, setSeasons] = useState([])
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [sort, setSort] = useState({ key: 'points', dir: 'desc' })
  const [liveAt, setLiveAt] = useState(0) // момент последнего live-обновления (для бейджа)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setIsLoading(true)
    setIsError(false)
    try {
      const res = await api.get('/standings', {
        params: { type, ...(season ? { season } : {}) },
      })
      setData(res.data.data)
    } catch {
      if (!silent) setIsError(true)
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [type, season])

  useEffect(() => { load() }, [load])

  // Список сезонов для исторических таблиц; ошибка не мешает текущей таблице.
  useEffect(() => {
    let cancelled = false
    api.get('/history/seasons')
      .then(({ data: response }) => {
        if (!cancelled) setSeasons(response.data || [])
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Live-обновление таблицы (лаба 7): событие standings:update → тихий refetch без спиннера
  useEffect(() => {
    return subscribe('standings:update', () => {
      setLiveAt(Date.now())
      load({ silent: true })
    })
  }, [subscribe, load])

  const standings = data?.standings || []

  const rankById = useMemo(() => {
    const map = new Map()
    standings.forEach((row, index) => map.set(row.id, index + 1))
    return map
  }, [standings])

  const sorted = useMemo(() => {
    const copy = [...standings]
    copy.sort((a, b) => {
      const va = valueFor(a, sort.key)
      const vb = valueFor(b, sort.key)
      let diff
      if (NUMERIC_KEYS.includes(sort.key)) diff = va - vb
      else diff = String(va).localeCompare(String(vb), 'ru')
      return sort.dir === 'asc' ? diff : -diff
    })
    return copy
  }, [standings, sort])

  const handleSort = (key) => {
    setSort((prev) => {
      if (prev.key === key) return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      return { key, dir: NUMERIC_KEYS.includes(key) ? 'desc' : 'asc' }
    })
  }

  const setType = (next) => {
    setSort({ key: 'points', dir: 'desc' })
    const params = new URLSearchParams(searchParams)
    if (next === 'constructors') params.set('type', 'constructors')
    else params.delete('type')
    setSearchParams(params)
  }

  const setSeason = (event) => {
    const next = new URLSearchParams(searchParams)
    if (event.target.value) next.set('season', event.target.value)
    else next.delete('season')
    setSearchParams(next)
  }

  if (isLoading) return <Spinner label="Загрузка таблицы…" />

  const tabClass = (active) =>
    `rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
      active
        ? 'bg-primary text-white dark:bg-accent dark:text-black'
        : 'text-muted hover:text-foreground dark:text-muted-dark dark:hover:text-foreground-dark'
    }`

  if (isError || !data) {
    return (
      <Card className="p-8 text-center">
        <p className="mb-4 text-sm font-medium text-red-500">Не удалось загрузить таблицу</p>
        <button
          type="button"
          onClick={() => load()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover dark:bg-accent dark:hover:bg-accent-hover"
        >
          Повторить
        </button>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground dark:text-foreground-dark">
          {type === 'constructors' ? 'Кубок конструкторов' : 'Личный зачёт'}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted dark:text-muted-dark">
          <span>Сезон {data.season}</span>
          {liveAt > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
              обновлено в реальном времени
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setType('drivers')} className={tabClass(type === 'drivers')}>
            Личный зачёт
          </button>
          <button type="button" onClick={() => setType('constructors')} className={tabClass(type === 'constructors')}>
            Кубок конструкторов
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {seasons.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-muted dark:text-muted-dark">
              Сезон
              <select
                value={season || (data?.season ? String(data.season) : '')}
                onChange={setSeason}
                className="rounded-lg border border-border-soft bg-card px-3 py-2 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark dark:focus:border-accent"
              >
                {seasons.map((item) => (
                  <option key={item.season} value={item.season}>{item.season}</option>
                ))}
              </select>
            </label>
          )}
          {season && (
            <Link
              to={`/history?season=${season}`}
              className="rounded-lg border border-border-soft px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-background dark:border-border-dark dark:text-foreground-dark dark:hover:bg-background-dark"
            >
              Гонки сезона →
            </Link>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-soft text-xs uppercase tracking-wide text-muted dark:border-border-dark dark:text-muted-dark">
                <th className="px-4 py-3 text-left font-semibold">#</th>
                <SortHeader label={type === 'drivers' ? 'Пилот' : 'Команда'} sortKey={type === 'drivers' ? 'driver' : 'team'} sort={sort} onSort={handleSort} />
                {type === 'drivers' && <SortHeader label="Команда" sortKey="team" sort={sort} onSort={handleSort} />}
                <SortHeader label="Победы" sortKey="wins" sort={sort} onSort={handleSort} align="center" />
                <SortHeader label="Подиумы" sortKey="podiums" sort={sort} onSort={handleSort} align="center" />
                <SortHeader label="Очки" sortKey="points" sort={sort} onSort={handleSort} align="right" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border-soft last:border-0 hover:bg-background dark:border-border-dark dark:hover:bg-background-dark"
                >
                  <td className="px-4 py-3 font-black text-muted dark:text-muted-dark">{rankById.get(row.id)}</td>
                  {type === 'drivers' ? (
                    <td className="px-4 py-3">
                      <Link
                        to={`/drivers/${row.id}`}
                        className="font-semibold text-foreground hover:text-primary dark:text-foreground-dark dark:hover:text-accent"
                      >
                        {row.firstName} {row.lastName}
                      </Link>
                    </td>
                  ) : (
                    <td className="px-4 py-3">
                      <Link
                        to={`/teams/${row.id}?season=${data.season}`}
                        className="inline-flex items-center gap-2 font-semibold text-foreground hover:text-primary dark:text-foreground-dark dark:hover:text-accent"
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color || '#0ea5e9' }} aria-hidden />
                        {row.name}
                      </Link>
                    </td>
                  )}
                  {type === 'drivers' && (
                    <td className="px-4 py-3">
                      {row.team ? (
                        <Link
                          to={`/teams/${row.team.id}?season=${data.season}`}
                          className="inline-flex items-center gap-2 text-muted hover:text-primary dark:text-muted-dark dark:hover:text-accent"
                        >
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.team.color || '#0ea5e9' }} aria-hidden />
                          {row.team.name}
                        </Link>
                      ) : (
                        <span className="text-muted dark:text-muted-dark">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 text-center text-foreground dark:text-foreground-dark">{row.wins}</td>
                  <td className="px-4 py-3 text-center text-foreground dark:text-foreground-dark">{row.podiums}</td>
                  <td className="px-4 py-3 text-right text-base font-bold text-foreground dark:text-foreground-dark">
                    {row.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}