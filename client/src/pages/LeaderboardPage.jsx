import { useCallback, useEffect, useMemo, useState } from 'react'
import useDocumentTitle from '../hooks/useDocumentTitle'
import api from '../api'
import { useSocket } from '../context/useSocket'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'

const SORTABLE = {
  points: 'баллам',
  predictions: 'количеству прогнозов',
  exactHits: 'точным попаданиям',
}

function SortHeader({ label, sortKey, sort, onSort, align = 'right', className = '' }) {
  const active = sort.key === sortKey
  const arrow = active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'
  return (
    <th className={`${className} px-2 py-3 font-semibold text-muted dark:text-muted-dark`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={`Сортировать по ${SORTABLE[sortKey] || label}`}
        className={`flex w-full items-center gap-1 transition-colors hover:text-foreground dark:hover:text-foreground-dark ${
          align === 'right' ? 'justify-end' : 'justify-start'
        } ${active ? 'text-foreground dark:text-foreground-dark' : ''}`}
      >
        {label}
        <span aria-hidden className="text-[10px]">{arrow}</span>
      </button>
    </th>
  )
}

export default function LeaderboardPage() {
  useDocumentTitle('Рейтинг предсказателей')
  const { subscribe } = useSocket()

  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState({ key: 'points', dir: 'desc' })

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await api.get('/leaderboard')
      setData(res.data.data)
    } catch (err) {
      if (err.response?.status === 503) setError('mongo-down')
      else setError(err.response?.data?.error || 'Не удалось загрузить рейтинг')
      setData(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    return subscribe('leaderboard:update', () => {
      load()
    })
  }, [subscribe, load])

  const users = data?.users || []
  const rules = data?.rules || { exact: 3, podium: 1 }

  const sortedUsers = useMemo(() => {
    const list = data?.users || []
    const direction = sort.dir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      const diff = (Number(a[sort.key]) || 0) - (Number(b[sort.key]) || 0)
      if (diff !== 0) return diff * direction
      return (Number(a.rank) || 0) - (Number(b.rank) || 0)
    })
  }, [data, sort])

  if (loading) return <Spinner label="Загрузка рейтинга…" />

  const handleSort = (key) => {
    setSort((prev) => (
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'desc' }
    ))
  }

  const rankBadge = (rank) => {
    if (rank === 1) return 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
    if (rank === 2) return 'bg-slate-500/15 text-slate-600 dark:text-slate-400'
    if (rank === 3) return 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
    return 'text-muted dark:text-muted-dark'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground dark:text-foreground-dark">
          Рейтинг предсказателей
        </h1>
        <p className="mt-1 text-sm text-muted dark:text-muted-dark">
          Баллы начисляются автоматически по результатам завершённых Гран-при.
        </p>
      </div>

      <Card className="p-6">
        <h2 className="mb-2 text-lg font-bold text-foreground dark:text-foreground-dark">
          Как считается
        </h2>
        <ul className="grid gap-1 text-sm text-muted dark:text-muted-dark sm:grid-cols-2">
          <li>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">+{rules.exact}</span>{' '}
            — за каждое точно угаданное место финиша
          </li>
          <li>
            <span className="font-bold text-primary dark:text-accent">+{rules.podium}</span> — пилот
            предсказан в ТОП-3 и реально финишировал в ТОП-3, но с другим местом
          </li>
          <li>
            Учитываются оба вида прогнозов: народный прогноз гонки и личный ТОП-3 из кабинета
          </li>
          <li>Не финишировал / нет результата — 0 баллов за пилота</li>
        </ul>
      </Card>

      {error && (
        <Card className="p-8 text-center">
          <p className="mb-4 text-sm font-medium text-red-500">
            {error === 'mongo-down'
              ? 'Рейтинг временно недоступен (MongoDB).'
              : error}
          </p>
          <button
            type="button"
            onClick={load}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover dark:bg-accent dark:hover:bg-accent-hover"
          >
            Повторить
          </button>
        </Card>
      )}

      {!error && data && (
        <Card className="overflow-hidden">
          <div className="flex items-baseline justify-between px-6 pt-5 pb-3">
            <h2 className="text-lg font-bold text-foreground dark:text-foreground-dark">Таблица</h2>
            <span className="text-xs text-muted dark:text-muted-dark">
              участников: {data.total}
            </span>
          </div>

          {users.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted dark:text-muted-dark">
              Пока нет оценённых прогнозов — баллы появятся после финиша первых гонок сезона.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-soft text-left dark:border-border-dark">
                    <th className="px-6 py-3 font-semibold text-muted dark:text-muted-dark">#</th>
                    <th className="px-2 py-3 font-semibold text-muted dark:text-muted-dark">
                      Пользователь
                    </th>
                    <SortHeader label="Баллы" sortKey="points" sort={sort} onSort={handleSort} className="text-right" />
                    <SortHeader label="Прогнозов" sortKey="predictions" sort={sort} onSort={handleSort} className="text-right" />
                    <SortHeader label="Точных / ТОП-3" sortKey="exactHits" sort={sort} onSort={handleSort} className="px-6 text-right" />
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map((row) => (
                    <tr
                      key={row.userId}
                      className="border-b border-border-soft last:border-0 dark:border-border-dark"
                    >
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${rankBadge(row.rank)}`}
                        >
                          {row.rank}
                        </span>
                      </td>
                      <td className="px-2 py-3 font-semibold text-foreground dark:text-foreground-dark">
                        {row.username}
                      </td>
                      <td className="px-2 py-3 text-right font-bold tabular-nums text-foreground dark:text-foreground-dark">
                        {row.points}
                      </td>
                      <td className="px-2 py-3 text-right tabular-nums text-muted dark:text-muted-dark">
                        {row.predictions}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums text-muted dark:text-muted-dark">
                        {row.exactHits} / {row.podiumHits}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
