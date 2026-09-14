import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'

export default function CabinetPage() {
  const { user, refreshMe } = useAuth()
  const [drivers, setDrivers] = useState([])
  const [teams, setTeams] = useState([])
  const [favDrivers, setFavDrivers] = useState(user?.favoriteDrivers || [])
  const [favTeams, setFavTeams] = useState(user?.favoriteTeams || [])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [dRes, tRes] = await Promise.all([api.get('/drivers'), api.get('/teams')])
        setDrivers(dRes.data.data || [])
        setTeams(tRes.data.data || [])
        if (user?.id) {
          const meRes = await api.get('/auth/me')
          setFavDrivers(meRes.data.data.favoriteDrivers || [])
          setFavTeams(meRes.data.data.favoriteTeams || [])
        }
      } catch { /* silent */ }
      setLoading(false)
    }
    load()
  }, [user?.id])

  const favDriverIds = useMemo(() => new Set(favDrivers.map(d => d.id)), [favDrivers])
  const favTeamIds = useMemo(() => new Set(favTeams.map(t => t.id)), [favTeams])

  const toggleFavDriver = async (driverId) => {
    setActionLoading(true)
    try {
      if (favDriverIds.has(driverId)) {
        await api.delete(`/users/${user.id}/favorite-drivers/${driverId}`)
        setFavDrivers(prev => prev.filter(d => d.id !== driverId))
      } else {
        await api.post(`/users/${user.id}/favorite-drivers`, { driverId })
        const driver = drivers.find(d => d.id === driverId)
        if (driver) setFavDrivers(prev => [...prev, driver])
      }
    } catch { /* silent */ }
    setActionLoading(false)
  }

  const toggleFavTeam = async (teamId) => {
    setActionLoading(true)
    try {
      if (favTeamIds.has(teamId)) {
        await api.delete(`/users/${user.id}/favorite-teams/${teamId}`)
        setFavTeams(prev => prev.filter(t => t.id !== teamId))
      } else {
        await api.post(`/users/${user.id}/favorite-teams`, { teamId })
        const team = teams.find(t => t.id === teamId)
        if (team) setFavTeams(prev => [...prev, team])
      }
    } catch { /* silent */ }
    setActionLoading(false)
  }

  if (loading) return <Spinner label="Загрузка кабинета…" />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground dark:text-foreground-dark">Кабинет</h1>
      </div>

      <Card className="p-6">
        <h2 className="mb-3 text-lg font-bold text-foreground dark:text-foreground-dark">Профиль</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted dark:text-muted-dark">Имя</dt>
            <dd className="font-semibold text-foreground dark:text-foreground-dark">{user?.username}</dd>
          </div>
          <div>
            <dt className="text-muted dark:text-muted-dark">Email</dt>
            <dd className="font-semibold text-foreground dark:text-foreground-dark">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-muted dark:text-muted-dark">Роль</dt>
            <dd>
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                user?.role === 'ADMIN'
                  ? 'bg-accent/20 text-accent dark:bg-accent/30'
                  : 'bg-primary/20 text-primary'
              }`}>
                {user?.role}
              </span>
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="p-6">
        <h2 className="mb-3 text-lg font-bold text-foreground dark:text-foreground-dark">
          Избранные пилоты <span className="text-sm font-normal text-muted dark:text-muted-dark">({favDrivers.length})</span>
        </h2>
        {drivers.length === 0 ? (
          <p className="text-sm text-muted dark:text-muted-dark">Нет данных о пилотах</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {drivers.map(d => (
              <Button
                key={d.id}
                size="sm"
                variant={favDriverIds.has(d.id) ? 'primary' : 'outline'}
                disabled={actionLoading}
                onClick={() => toggleFavDriver(d.id)}
              >
                {d.firstName} {d.lastName}
              </Button>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="mb-3 text-lg font-bold text-foreground dark:text-foreground-dark">
          Избранные команды <span className="text-sm font-normal text-muted dark:text-muted-dark">({favTeams.length})</span>
        </h2>
        {teams.length === 0 ? (
          <p className="text-sm text-muted dark:text-muted-dark">Нет данных о командах</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {teams.map(t => (
              <Button
                key={t.id}
                size="sm"
                variant={favTeamIds.has(t.id) ? 'primary' : 'outline'}
                disabled={actionLoading}
                onClick={() => toggleFavTeam(t.id)}
              >
                <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                {t.name}
              </Button>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="mb-3 text-lg font-bold text-foreground dark:text-foreground-dark">Прогнозы</h2>
        <p className="text-sm text-muted dark:text-muted-dark">
          Функция прогнозов будет доступна после реализации MongoDB (Лабораторная работа 6).
        </p>
      </Card>
    </div>
  )
}