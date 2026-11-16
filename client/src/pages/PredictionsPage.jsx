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
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-6 pt-5 pb-3">
              <h2 className="text-lg font-bold text-foreground dark:text-foreground-dark">
                Вероятности
              </h2>
              <span className="text-xs text-muted dark:text-muted-dark">
                сумма: 100,00 %
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-y border-border-soft bg-background/60 text-left text-xs uppercase tracking-wide text-muted dark:border-border-dark dark:bg-background-dark/60 dark:text-muted-dark">
                    <th className="px-4 py-2.5 text-right font-semibold">#</th>
                    <th className="px-2 py-2.5 font-semibold">Пилот</th>
                    <th className="px-2 py-2.5 text-right font-semibold" title="Вес 0,35 · стартовая позиция">
                      <FormulaLabel base="P" sub="qual" />
                    </th>
                    <th className="px-2 py-2.5 text-right font-semibold" title="Вес 0,30 · форма пилота">
                      <FormulaLabel base="F" sub="driver" />
                    </th>
                    <th className="px-2 py-2.5 text-right font-semibold" title="Вес 0,20 · форма команды">
                      <FormulaLabel base="F" sub="team" />
                    </th>
                    <th className="px-2 py-2.5 text-right font-semibold" title="Вес 0,15 · история трассы">
                      <FormulaLabel base="H" sub="track" />
                    </th>
                    <th className="px-2 py-2.5 text-right font-semibold" title="Итоговый балл до Softmax">
                      <FormulaLabel base="S" sub="i" />
                    </th>
                    <th className="px-6 py-2.5 text-right font-semibold">Вероятность</th>
                  </tr>
                </thead>
                <tbody>
                  {data.drivers.map((d, index) => (
                    <tr
                      key={d.id}
                      className={`border-b border-border-soft/70 last:border-0 dark:border-border-dark/70 ${
                        index % 2 === 1 ? 'bg-background/40 dark:bg-background-dark/40' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5 text-right font-mono text-muted dark:text-muted-dark">
                        {index + 1}
                      </td>
                      <td className="px-2 py-2.5">
                        <span className="flex min-w-0 flex-wrap items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-border-soft dark:ring-border-dark"
                            style={{ backgroundColor: d.team?.color || '#0ea5e9' }}
                            aria-hidden
                          />
                          <span className="font-semibold text-foreground dark:text-foreground-dark">
                            {d.firstName} {d.lastName}
                          </span>
                          <span className="truncate text-xs text-muted dark:text-muted-dark">
                            {d.team?.name}
                          </span>
                          {FORM_SOURCE_LABELS[d.formSource] && d.formSource !== 'current' && (
                            <span className="shrink-0 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                              {FORM_SOURCE_LABELS[d.formSource]}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono tabular-nums text-foreground dark:text-foreground-dark">
                        {Number(d.features?.P_qual ?? 0).toFixed(3)}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono tabular-nums text-foreground dark:text-foreground-dark">
                        {Number(d.features?.F_driver ?? 0).toFixed(3)}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono tabular-nums text-foreground dark:text-foreground-dark">
                        {Number(d.features?.F_team ?? 0).toFixed(3)}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono tabular-nums text-foreground dark:text-foreground-dark">
                        {Number(d.features?.H_track ?? 0).toFixed(3)}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono tabular-nums text-muted dark:text-muted-dark">
                        {Number(d.score ?? 0).toFixed(4)}
                      </td>
                      <td className="px-6 py-2.5 text-right font-mono font-bold tabular-nums text-primary dark:text-accent">
                        {Number(d.probability ?? 0).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-border-soft px-6 py-3 text-xs text-muted dark:border-border-dark dark:text-muted-dark">
              Вероятности нормированы: сумма по всем пилотам всегда ровно 100,00 %.
              Округление — методом наибольшего остатка, поэтому отдельные значения
              могут отличаться от простого округления на 0,01 п.п.
            </p>
          </Card>
        </>
      )}
    </div>
  )
}
