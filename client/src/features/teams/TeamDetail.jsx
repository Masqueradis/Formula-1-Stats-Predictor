import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../../api'
import Card from '../../components/ui/Card'
import Spinner from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'
import FavoriteButton from '../../components/FavoriteButton'
import useDocumentTitle from '../../hooks/useDocumentTitle'

export default function TeamDetail() {
  const { id } = useParams()
  const [team, setTeam] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  useDocumentTitle(team ? team.name : 'Команда')

  const load = useCallback(async () => {
    setIsLoading(true)
    setIsError(false)
    try {
      const { data } = await api.get(`/teams/${id}`)
      setTeam(data.data)
    } catch {
      setIsError(true)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (isLoading) return <Spinner label="Загрузка команды…" />

  if (isError || !team) {
    return (
      <Card className="p-8 text-center">
        <p className="mb-4 text-sm font-medium text-red-500">Не удалось загрузить данные команды</p>
        <div className="flex justify-center gap-2">
          <Button onClick={load}>Повторить</Button>
          <Link to="/teams"><Button variant="outline">К списку команд</Button></Link>
        </div>
      </Card>
    )
  }

  const color = team.color || '#0ea5e9'
  const drivers = team.drivers || []

  return (
    <div className="space-y-6">
      <Link to="/teams" className="inline-block text-sm font-medium text-muted hover:text-primary dark:text-muted-dark dark:hover:text-accent">
        ← Все команды
      </Link>

      <Card className="overflow-hidden">
        <div
          className="flex h-40 items-end px-6 pb-4 sm:px-8"
          style={{ backgroundImage: `linear-gradient(135deg, ${color}, #0f172a)` }}
        >
          <h1 className="text-3xl font-black uppercase tracking-wide text-white drop-shadow">{team.name}</h1>
        </div>

        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted dark:text-muted-dark">Руководитель</dt>
              <dd className="mt-1 font-semibold text-foreground dark:text-foreground-dark">{team.principal || '—'}</dd>
            </div>
            <div>
              <dt className="text-muted dark:text-muted-dark">Национальность</dt>
              <dd className="mt-1 font-semibold text-foreground dark:text-foreground-dark">{team.nationality || '—'}</dd>
            </div>
            {team.url && (
              <div className="sm:col-span-2">
                <dt className="text-muted dark:text-muted-dark">Сайт</dt>
                <dd className="mt-1">
                  <a
                    href={team.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary hover:underline dark:text-accent"
                  >
                    {team.url}
                  </a>
                </dd>
              </div>
            )}
          </dl>

          <FavoriteButton type="teams" entityId={team.id} />
        </div>
      </Card>

      <Card className="p-6 sm:p-8">
        <h2 className="mb-4 text-lg font-bold text-foreground dark:text-foreground-dark">
          Состав <span className="text-sm font-normal text-muted dark:text-muted-dark">({drivers.length})</span>
        </h2>
        {drivers.length === 0 ? (
          <p className="text-sm text-muted dark:text-muted-dark">Нет данных о пилотах</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {drivers.map((driver) => (
              <Link
                key={driver.id}
                to={`/drivers/${driver.id}`}
                className="flex items-center gap-3 rounded-lg border border-border-soft px-4 py-3 transition-colors hover:bg-background dark:border-border-dark dark:hover:bg-background-dark"
              >
                <span className="font-mono text-lg font-black italic text-muted dark:text-muted-dark">
                  {driver.abbreviation}
                </span>
                <span className="font-semibold text-foreground dark:text-foreground-dark">
                  {driver.firstName} {driver.lastName}
                </span>
                {driver.number != null && (
                  <span className="ml-auto text-sm text-muted dark:text-muted-dark">№{driver.number}</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}