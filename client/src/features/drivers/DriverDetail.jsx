import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../../api'
import Card from '../../components/ui/Card'
import Spinner from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'
import FavoriteButton from '../../components/FavoriteButton'
import useDocumentTitle from '../../hooks/useDocumentTitle'

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
  // Биография из Wikipedia (эпик-09, P2): отдельный стейт, ошибка не валит страницу
  const [wiki, setWiki] = useState(null)
  const [wikiState, setWikiState] = useState('idle') // idle | loading | ready | error
  // Карьера (эпик-09, P4): Jolpica + локальный fallback
  const [career, setCareer] = useState(null)
  const [careerState, setCareerState] = useState('idle')
  useDocumentTitle(driver ? `${driver.firstName} ${driver.lastName}` : 'Пилот')

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

  useEffect(() => {
    let cancelled = false
    setWikiState('loading')
    api.get(`/drivers/${id}/wiki`)
      .then(({ data }) => {
        if (!cancelled) {
          setWiki(data.data)
          setWikiState('ready')
        }
      })
      .catch(() => {
        if (!cancelled) setWikiState('error')
      })
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    let cancelled = false
    setCareerState('loading')
    api.get(`/drivers/${id}/career`)
      .then(({ data }) => {
        if (!cancelled) {
          setCareer(data.data)
          setCareerState('ready')
        }
      })
      .catch(() => {
        if (!cancelled) setCareerState('error')
      })
    return () => { cancelled = true }
  }, [id])

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

      {careerState === 'ready' && career && (
        <Card className="p-6 sm:p-8">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold text-foreground dark:text-foreground-dark">Карьера</h2>
            <span className="text-xs text-muted dark:text-muted-dark">
              {career.source === 'jolpica' ? 'Jolpica: вся карьера' : 'По данным приложения'}
              {career.career?.firstSeason && ` · ${career.career.firstSeason}–${career.career.lastSeason}`}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            {[
              ['Гонки', career.career?.starts],
              ['Победы', career.career?.wins],
              ['Подиумы', career.career?.podiums],
              ['Поулы', career.career?.poles],
              ['Быстрые круги', career.career?.fastestLaps],
              ['Очки', career.career?.points],
              ['Сходы', career.career?.dnfs],
              ['Лучший финиш', career.career?.bestFinish ?? '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted dark:text-muted-dark">{label}</dt>
                <dd className="mt-1 text-2xl font-bold text-foreground dark:text-foreground-dark">
                  {value ?? 0}
                </dd>
              </div>
            ))}
          </dl>

          {career.fallbackReason && (
            <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-400">
              История Jolpica недоступна — показаны только синхронизированные результаты.
            </p>
          )}

          {career.career?.seasons?.length > 0 && (
            <details className="mt-5">
              <summary className="cursor-pointer text-sm font-semibold text-primary dark:text-accent">
                По сезонам
              </summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-muted dark:text-muted-dark">
                    <tr>
                      <th className="py-2">Сезон</th>
                      <th>Гонки</th>
                      <th>Победы</th>
                      <th>Подиумы</th>
                      <th>Очки</th>
                    </tr>
                  </thead>
                  <tbody>
                    {career.career.seasons.map((season) => (
                      <tr key={season.season} className="border-t border-border-soft dark:border-border-dark">
                        <td className="py-2 font-semibold text-foreground dark:text-foreground-dark">{season.season}</td>
                        <td>{season.starts}</td>
                        <td>{season.wins}</td>
                        <td>{season.podiums}</td>
                        <td>{season.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </Card>
      )}

      {wikiState === 'ready' && wiki && (
        <Card className="p-6 sm:p-8">
          <h2 className="mb-4 text-lg font-bold text-foreground dark:text-foreground-dark">О пилоте</h2>
          <div className="flex flex-col gap-5 sm:flex-row">
            {wiki.thumbnail && (
              <img
                src={wiki.thumbnail}
                alt={wiki.title}
                loading="lazy"
                className="h-40 w-32 shrink-0 self-center rounded-xl object-cover sm:self-start"
              />
            )}
            <div className="min-w-0">
              <p className="text-sm leading-relaxed text-foreground dark:text-foreground-dark">
                {wiki.extract}
              </p>
              <a
                href={wiki.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm font-semibold text-primary underline hover:text-primary-hover dark:text-accent"
              >
                Wikipedia ({wiki.lang}) →
              </a>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}