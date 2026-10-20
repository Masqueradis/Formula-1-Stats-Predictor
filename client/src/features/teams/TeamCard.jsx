import { Link } from 'react-router-dom'
import Card from '../../components/ui/Card'

export default function TeamCard({ team }) {
  const color = team.color || '#0ea5e9'
  const driverCount = team.drivers?.length || 0

  return (
    <Link to={`/teams/${team.id}`} className="block h-full">
      <Card className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lg">
        <div
          className="flex h-28 items-center px-5"
          style={{ backgroundImage: `linear-gradient(135deg, ${color}, #0f172a)` }}
        >
          <span className="text-xl font-black uppercase tracking-wide text-white drop-shadow">
            {team.name}
          </span>
        </div>

        <div className="flex flex-1 flex-col p-4 sm:p-5">
          {team.principal && (
            <p className="text-sm text-muted dark:text-muted-dark">
              Руководитель: <span className="font-semibold text-foreground dark:text-foreground-dark">{team.principal}</span>
            </p>
          )}
          {team.nationality && (
            <p className="mt-0.5 text-sm text-muted dark:text-muted-dark">{team.nationality}</p>
          )}

          <div className="mt-3 flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
            <span className="truncate text-xs font-semibold uppercase tracking-wider text-muted dark:text-muted-dark">
              Пилоты: {driverCount}
            </span>
          </div>

          <span className="mt-auto pt-3 text-xs font-semibold text-primary dark:text-accent">
            Подробнее →
          </span>
        </div>
      </Card>
    </Link>
  )
}