import { useCallback, useEffect, useState } from 'react'
import useDocumentTitle from '../hooks/useDocumentTitle'
import api from '../api'
import Card from '../components/ui/Card'
import FormulaLabel from '../components/ui/FormulaLabel'
import Spinner from '../components/ui/Spinner'

const WEIGHT_NOTES = [
  ['P', 'qual', 'стартовая позиция (средняя grid за сезон)'],
  ['F', 'driver', 'форма пилота (последние 5 гонок)'],
  ['F', 'team', 'форма команды (очки в сезоне)'],
  ['H', 'track', 'история выступлений на трассе'],
]

const FORM_SOURCE_LABELS = {
  previous: 'прошлый сезон',
  blended: 'текущий + прошлый',
}

function formatDate(value) {
  if (!value) return 'дата неизвестна'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function PredictionsPage() {
  useDocumentTitle('Прогнозы')
  const [data, setData] = useState(null)
  const [error, setError] = useState('') // '' | 'no-race' | текст ошибки
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/probabilities/next')
      setData(res.data.data)
    } catch (err) {
      if (err.response?.status === 404) setError('no-race')
      else setError(err.response?.data?.error || 'Не удалось рассчитать прогноз')
      setData(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <Spinner label="Рассчитываем прогноз…" />

  const maxProb = data?.drivers?.[0]?.probability || 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground dark:text-foreground-dark">Прогнозы</h1>
        <p className="mt-1 text-sm text-muted dark:text-muted-dark">
          Алгоритм Softmax оценивает шансы пилотов на ближайший Гран-при.
        </p>
      </div>

      {error && (
        <Card className="p-8 text-center">
          <p className="mb-4 text-sm font-medium text-red-500">
            {error === 'no-race'
              ? 'Ближайшая Гран-при не запланирована — календарь пуст.'
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
        <>
          <Card className="p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold text-foreground dark:text-foreground-dark">
                {data.race.name}
              </h2>
              <span className="text-sm text-muted dark:text-muted-dark">
                Сезон {data.race.season}, этап {data.race.round} · {formatDate(data.race.date)}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted dark:text-muted-dark">
              {[data.race.circuit, data.race.country].filter(Boolean).join(' · ')}
            </p>
            <div className="mt-4 rounded-lg bg-background p-4 text-xs text-muted dark:bg-background-dark dark:text-muted-dark">
              <span className="font-mono">
                <FormulaLabel base="S" sub="i" /> = {data.weights.P_qual}·<FormulaLabel base="P" sub="qual" /> +{' '}
                {data.weights.F_driver}·<FormulaLabel base="F" sub="driver" /> +{' '}
                {data.weights.F_team}·<FormulaLabel base="F" sub="team" /> +{' '}
                {data.weights.H_track}·<FormulaLabel base="H" sub="track" /> → Softmax
              </span>
            </div>
            <ul className="mt-2 grid gap-1 text-xs text-muted dark:text-muted-dark sm:grid-cols-2">
              {WEIGHT_NOTES.map(([base, sub, note]) => (
                <li key={`${base}-${sub}`}>
                  <span className="font-semibold text-foreground dark:text-foreground-dark">
                    <FormulaLabel base={base} sub={sub} />
                  </span> — {note}
                </li>
              ))}
            </ul>
            {data.basis?.usesPreviousSeason && (
              <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                В начале сезона формула подмешивает прошлый сезон {data.basis.previousSeason}:
                сыграно гонок в текущем сезоне — {data.basis.currentRaces}, в прошлом — {data.basis.previousRaces}.
                Влияние прошлого сезона исчезает после {data.basis.formWindow} гонок.
              </p>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="px-6 pt-5 pb-2">
              <h2 className="text-lg font-bold text-foreground dark:text-foreground-dark">
                Вероятности (%)
              </h2>
            </div>
            <ul className="space-y-3 p-6 pt-3">
              {data.drivers.map((d, index) => (
                <li
                  key={d.id}
                  title={`S=${d.score} · старт ${d.features.P_qual} · форма ${d.features.F_driver} · команда ${d.features.F_team} · трасса ${d.features.H_track}`}
                >
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="w-5 shrink-0 text-right font-mono text-muted dark:text-muted-dark">
                        {index + 1}
                      </span>
                      <span className="font-semibold text-foreground dark:text-foreground-dark">
                        {d.firstName} {d.lastName}
                      </span>
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-border-soft"
                        style={{ backgroundColor: d.team?.color || '#0ea5e9' }}
                        aria-hidden
                      />
                      <span className="truncate text-xs text-muted dark:text-muted-dark">
                        {d.team?.name}
                      </span>
                      {FORM_SOURCE_LABELS[d.formSource] && (
                        <span className="shrink-0 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                          {FORM_SOURCE_LABELS[d.formSource]}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-bold tabular-nums text-foreground dark:text-foreground-dark">
                      {d.probability.toFixed(2)}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-background dark:bg-background-dark">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(2, (d.probability / maxProb) * 100)}%`,
                        backgroundColor: d.team?.color || '#0ea5e9',
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  )
}
