import { useCallback, useEffect, useState } from 'react'
import api from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Select from '../../components/ui/Select'
import Spinner from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/useToast'
import { useAuth } from '../../context/useAuth'

const EMPTY_SLOTS = { 1: '', 2: '', 3: '' }

function formatDate(value) {
  if (!value) return 'дата неизвестна'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * US-5 — личный прогноз ТОП-3 на ближайший Гран-при (кабинет).
 *
 * Бэкенд: `kind: 'top3'` в predictionService (по одному 'full' и 'top3' на пользователя).
 * POST — новый прогноз, PUT — правка существующего (привязка к пользователю — userId из JWT).
 */
export default function Top3Form() {
  const toast = useToast()
  const { user } = useAuth()

  const [doc, setDoc] = useState(null)
  const [error, setError] = useState('') // '' | 'no-race' | 'mongo-down' | текст
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasMyVote, setHasMyVote] = useState(false)
  const [slots, setSlots] = useState(EMPTY_SLOTS)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/predictions/next')
      const nextDoc = data.data
      setDoc(nextDoc)

      const mine = (nextDoc.votes || []).find((v) => v.userId === user?.id && v.kind === 'top3')
      setHasMyVote(Boolean(mine))
      if (mine) {
        const byPos = {}
        for (const pick of mine.picks) byPos[pick.position] = String(pick.driverId)
        setSlots({ 1: byPos[1] || '', 2: byPos[2] || '', 3: byPos[3] || '' })
      } else {
        setSlots(EMPTY_SLOTS)
      }
    } catch (err) {
      const status = err.response?.status
      if (status === 404) setError('no-race')
      else if (status === 503) setError('mongo-down')
      else setError(err.response?.data?.error || 'Не удалось загрузить прогноз')
      setDoc(null)
    }
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    load()
  }, [load])

  const entryById = new Map((doc?.entries || []).map((e) => [e.driverId, e]))
  const selectedIds = [1, 2, 3].map((pos) => Number(slots[pos])).filter((id) => id > 0)
  const complete = selectedIds.length === 3 && new Set(selectedIds).size === 3
  const votingOpen = Boolean(doc?.votingOpen)

  const save = async () => {
    if (!complete || !doc) return
    const picks = [1, 2, 3].map((pos) => ({ driverId: Number(slots[pos]), position: pos }))
    setSaving(true)
    try {
      const url = `/predictions/race/${doc.raceId}/votes`
      const { data } = hasMyVote
        ? await api.put(`${url}/${user.id}`, { kind: 'top3', picks })
        : await api.post(url, { kind: 'top3', picks })
      setHasMyVote(true)
      setDoc((prev) => ({ ...prev, votes: data.data.votes }))
      toast.success('Личный прогноз ТОП-3 сохранён')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Не удалось сохранить прогноз')
    }
    setSaving(false)
  }

  if (loading) return <Spinner label="Загрузка прогноза…" />

  return (
    <Card className="p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-foreground dark:text-foreground-dark">
          Личный прогноз ТОП-3
        </h2>
        {hasMyVote && (
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            Прогноз отправлен
          </span>
        )}
      </div>

      {error && (
        <div className="space-y-3">
          <p className="text-sm text-red-500">
            {error === 'no-race' && 'Ближайшая Гран-при не запланирована — календарь пуст.'}
            {error === 'mongo-down' && 'Прогнозы временно недоступны (MongoDB).'}
            {error !== 'no-race' && error !== 'mongo-down' && error}
          </p>
          <Button variant="outline" size="sm" onClick={load}>Повторить</Button>
        </div>
      )}

      {!error && doc && (
        <div className="space-y-4">
          <p className="text-sm text-muted dark:text-muted-dark">
            Расставьте три места в порядке финиша на{' '}
            <span className="font-semibold text-foreground dark:text-foreground-dark">
              {doc.raceName || 'ближайшую гонку'}
            </span>
            {doc.date ? ` (${formatDate(doc.date)})` : ''} — прогноз участвует в рейтинге
            предсказателей.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((pos) => (
              <Select
                key={pos}
                label={`${pos}-е место`}
                value={slots[pos]}
                disabled={!votingOpen || saving}
                onChange={(e) => setSlots((prev) => ({ ...prev, [pos]: e.target.value }))}
              >
                <option value="">— не выбран —</option>
                {(doc.entries || []).map((entry) => {
                  const taken = [1, 2, 3].some(
                    (other) => other !== pos && Number(slots[other]) === entry.driverId,
                  )
                  return (
                    <option key={entry.driverId} value={entry.driverId} disabled={taken}>
                      {entry.firstName ? `${entry.firstName} ` : ''}
                      {entry.lastName}
                      {entry.teamName ? ` — ${entry.teamName}` : ''}
                    </option>
                  )
                })}
              </Select>
            ))}
          </div>

          {!votingOpen && (
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              Голосование закрыто — уик-энд Гран-при начался. Изменить прогноз нельзя.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={save} disabled={!complete || !votingOpen || saving}>
              {saving ? 'Сохранение…' : hasMyVote ? 'Обновить прогноз' : 'Сохранить прогноз'}
            </Button>
            {hasMyVote && votingOpen && (
              <Button
                variant="ghost"
                size="sm"
                disabled={saving}
                onClick={() => setSlots(EMPTY_SLOTS)}
              >
                Очистить
              </Button>
            )}
            <span className="text-xs text-muted dark:text-muted-dark">
              {complete ? 'Все три места выбраны' : `Осталось выбрать: ${3 - new Set(selectedIds).size}`}
            </span>
          </div>

          {hasMyVote && (
            <ul className="space-y-1 border-t border-border-soft pt-3 text-sm dark:border-border-dark">
              {[1, 2, 3].map((pos) => {
                const entry = entryById.get(Number(slots[pos]))
                return (
                  <li key={pos} className="flex items-center gap-2">
                    <span className="w-5 font-bold text-muted dark:text-muted-dark">{pos}</span>
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: entry?.teamColor || '#0ea5e9' }}
                      aria-hidden
                    />
                    <span className="font-semibold text-foreground dark:text-foreground-dark">
                      {entry ? `${entry.firstName} ${entry.lastName}` : '—'}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}
