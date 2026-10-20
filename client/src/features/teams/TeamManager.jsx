import { useCallback, useEffect, useState } from 'react'
import api from '../../api'
import TeamCard from './TeamCard'
import Card from '../../components/ui/Card'
import Spinner from '../../components/ui/Spinner'

export default function TeamManager() {
  const [teams, setTeams] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setIsError(false)
    try {
      const { data } = await api.get('/teams')
      setTeams(data.data || [])
    } catch {
      setIsError(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (isLoading) return <Spinner label="Загрузка команд…" />

  if (isError) {
    return (
      <Card className="p-8 text-center">
        <p className="mb-4 text-sm font-medium text-red-500">Не удалось загрузить команды</p>
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
      <h1 className="text-2xl font-bold text-foreground dark:text-foreground-dark">Команды</h1>
      {teams.length === 0 ? (
        <Card className="border-dashed p-8 text-center text-muted dark:text-muted-dark">Нет команд</Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      )}
    </div>
  )
}