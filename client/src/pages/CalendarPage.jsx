import { useCallback, useEffect, useState } from 'react'
import api from '../api'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'

const STATUS = {
  finished: { label: 'Завершена', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  scheduled: { label: 'Запланирована', className: 'bg-primary/15 text-primary dark:bg-accent/15 dark:text-accent' },
  cancelled: { label: 'Отменена', className: 'bg-red-500/15 text-red-500' },
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function CalendarPage() {
  const [races, setRaces] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setIsError(false)
    try {
      const { data } = await api.get('/races')
      const sorted = [...(data.data || [])].sort(
        (a, b) => (a.season - b.season) || (a.round - b.round),
      )
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
      <h1 className="text-2xl font-bold text-foreground dark:text-foreground-dark">Календарь Гран-при</h1>

      {races.length === 0 ? (
        <Card className="border-dashed p-8 text-center text-muted dark:text-muted-dark">Нет гонок</Card>
      ) : (
        <div className="space-y-3">
          {races.map((race) => {
            const status = STATUS[race.status] || STATUS.scheduled
            return (
              <Card key={race.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 dark:bg-accent/10">
                  <span className="text-[10px] font-bold uppercase text-muted dark:text-muted-dark">Этап</span>
                  <span className="text-lg font-black text-primary dark:text-accent">{race.round}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-bold text-foreground dark:text-foreground-dark">{race.name}</h2>
                  <p className="mt-0.5 truncate text-sm text-muted dark:text-muted-dark">
                    {[race.circuit, race.country].filter(Boolean).join(' · ')}
                  </p>
                </div>

                <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-1">
                  <span className="text-sm font-medium text-foreground dark:text-foreground-dark">
                    {formatDate(race.date)}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                {race.winner && (
                  <div className="shrink-0 rounded-lg border border-border-soft px-3 py-1.5 text-xs dark:border-border-dark sm:ml-2">
                    <span className="text-muted dark:text-muted-dark">Победитель: </span>
                    <span className="font-bold text-foreground dark:text-foreground-dark">
                      {race.winner.firstName} {race.winner.lastName}
                    </span>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}