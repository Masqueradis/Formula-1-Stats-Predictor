import useDocumentTitle from '../hooks/useDocumentTitle'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import Card from '../components/ui/Card'
import Top3Form from '../features/predictions/Top3Form'

export default function CabinetPage() {
  useDocumentTitle('Личный кабинет')
  const { user } = useAuth()
  const favDrivers = user?.favoriteDrivers || []
  const favTeams = user?.favoriteTeams || []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground dark:text-foreground-dark">Кабинет</h1>

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
        {favDrivers.length === 0 ? (
          <p className="text-sm text-muted dark:text-muted-dark">
            Пока никого нет. Добавляйте пилотов в избранное на их страницах.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {favDrivers.map((driver) => (
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
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="mb-3 text-lg font-bold text-foreground dark:text-foreground-dark">
          Избранные команды <span className="text-sm font-normal text-muted dark:text-muted-dark">({favTeams.length})</span>
        </h2>
        {favTeams.length === 0 ? (
          <p className="text-sm text-muted dark:text-muted-dark">
            Пока никого нет. Добавляйте команды в избранное на их страницах.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {favTeams.map((team) => (
              <Link
                key={team.id}
                to={`/teams/${team.id}`}
                className="flex items-center gap-3 rounded-lg border border-border-soft px-4 py-3 transition-colors hover:bg-background dark:border-border-dark dark:hover:bg-background-dark"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: team.color || '#0ea5e9' }} aria-hidden />
                <span className="font-semibold text-foreground dark:text-foreground-dark">{team.name}</span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* US-5: личный прогноз ТОП-3 (kind: 'top3', привязка к userId из JWT) */}
      <Top3Form />

      <Card className="p-6">
        <h2 className="mb-3 text-lg font-bold text-foreground dark:text-foreground-dark">Прогнозы</h2>
        <p className="text-sm text-muted dark:text-muted-dark">
          Общий (народный) прогноз на следующий Гран-при и комментарии доступны на{' '}
          <Link to="/vote" className="font-semibold text-primary underline dark:text-accent">странице «Голосование»</Link>{' '}
          (MongoDB, лаба 6). Вероятности алгоритма Softmax — в разделе{' '}
          <Link to="/predictions" className="font-semibold text-primary underline dark:text-accent">«Прогнозы»</Link>.
        </p>
      </Card>
    </div>
  )
}