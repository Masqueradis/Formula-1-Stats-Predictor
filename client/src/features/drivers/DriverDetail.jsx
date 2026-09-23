import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../../api'
import Card from '../../components/ui/Card'
import Spinner from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'
import FavoriteButton from '../../components/FavoriteButton'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function DriverDetail() {
  const { id } = useParams()
  const [driver, setDriver] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setIsError(false)
    try {
      const { data } = await api.get(`/drivers/${id}`)
      setDriver(data.data)
    } catch {
      setIsError(true)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (isLoading) return <Spinner label="Загрузка пилота…" />

  if (isError || !driver) {
    return (
      <Card className="p-8 text-center">
        <p className="mb-4 text-sm font-medium text-red-500">Не удалось загрузить данные пилота</p>
        <div className="flex justify-center gap-2">
          <Button onClick={load}>Повторить</Button>
          <Link to="/drivers"><Button variant="outline">К списку пилотов</Button></Link>
        </div>
      </Card>
    )
  }

  const color = driver.team?.color || '#0ea5e9'

  return (
    <div className="space-y-6">
      <Link to="/drivers" className="inline-block text-sm font-medium text-muted hover:text-primary dark:text-muted-dark dark:hover:text-accent">
        ← Все пилоты
      </Link>

      <Card className="overflow-hidden">
        <div
          className="relative flex h-52 items-end px-6 pb-4 sm:px-8"
          style={{ backgroundImage: `linear-gradient(135deg, ${color}, #0f172a)` }}
        >
          <span className="font-mono text-6xl font-black italic tracking-wider text-white/90">
            {driver.abbreviation}
          </span>
        </div>

        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8">
          <div>
            <h1 className="text-3xl font-extrabold text-foreground dark:text-foreground-dark">
              {driver.firstName} {driver.lastName}
            </h1>
            <p className="mt-1 text-muted dark:text-muted-dark">
              {driver.nationality} · №{driver.number}
            </p>

            {driver.team && (
              <Link
                to={`/teams/${driver.team.id}`}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border-soft px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-background dark:border-border-dark dark:text-foreground-dark dark:hover:bg-background-dark"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                {driver.team.name}
              </Link>
            )}
          </div>

          <FavoriteButton type="drivers" entityId={driver.id} />
        </div>
      </Card>

      <Card className="p-6 sm:p-8">
        <h2 className="mb-4 text-lg font-bold text-foreground dark:text-foreground-dark">Статистика</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted dark:text-muted-dark">Номер болида</dt>
            <dd className="mt-1 text-2xl font-bold text-foreground dark:text-foreground-dark">{driver.number}</dd>
          </div>
          <div>
            <dt className="text-muted dark:text-muted-dark">Подиумы</dt>
            <dd className="mt-1 text-2xl font-bold text-foreground dark:text-foreground-dark">{driver.podiums || 0}</dd>
          </div>
          <div>
            <dt className="text-muted dark:text-muted-dark">Дата рождения</dt>
            <dd className="mt-1 text-2xl font-bold text-foreground dark:text-foreground-dark">{formatDate(driver.dateOfBirth)}</dd>
          </div>
        </dl>
      </Card>
    </div>
  )
}