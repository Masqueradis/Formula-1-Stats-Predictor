import { Link } from 'react-router-dom'
import Card from '../../components/ui/Card'

export default function DriverCard({ driver }) {
  const teamName = driver.team?.name || 'Без команды'
  const color = driver.team?.color || '#0ea5e9'

  return (
    <Link to={`/drivers/${driver.id}`} className="block h-full">
      <Card className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lg">
        <div className="relative h-40 w-full shrink-0">
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ backgroundImage: `linear-gradient(135deg, ${color}, #0f172a)` }}
          >
            <span className="font-mono text-4xl font-black italic tracking-wider text-white/90">{driver.abbreviation}</span>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <span className="absolute bottom-2 left-4 text-3xl font-black italic tracking-wider text-white drop-shadow">
            {driver.abbreviation}
          </span>
        </div>

        <div className="flex flex-1 flex-col p-4 sm:p-5">
          <h3 className="line-clamp-2 break-words text-lg font-bold leading-snug text-foreground dark:text-foreground-dark">
            {driver.firstName} {driver.lastName}
          </h3>
          <p className="mt-0.5 text-sm text-muted dark:text-muted-dark">
            {driver.nationality} · №{driver.number} · подиумы: {driver.podiums || 0}
          </p>

          <div className="mt-3 flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
            <span className="truncate text-xs font-semibold uppercase tracking-wider text-muted dark:text-muted-dark">
              {teamName}
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