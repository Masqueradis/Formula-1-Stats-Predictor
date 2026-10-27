import useDocumentTitle from '../../hooks/useDocumentTitle'
import { useCallback, useEffect, useState } from 'react'
import api from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Spinner from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/useToast'

const EMPTY_FORM = {
  name: '',
  circuit: '',
  country: '',
  date: '',
  season: '',
  round: '',
  status: 'scheduled',
  trackLatitude: '',
  trackLongitude: '',
  broadcastUrl: '',
}

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Запланирована' },
  { value: 'finished', label: 'Завершена' },
  { value: 'cancelled', label: 'Отменена' },
]

const STATUS_BADGES = {
  finished: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  scheduled: 'bg-primary/15 text-primary dark:bg-accent/15 dark:text-accent',
  cancelled: 'bg-red-500/15 text-red-500',
}

const STATUS_LABELS = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s.label]))

/** US-7: пусто → ссылки нет; иначе должен быть http(s)-URL (сервер тоже валидирует) */
function isValidBroadcastUrl(value) {
  const trimmed = String(value || '').trim()
  return !trimmed || /^https?:\/\/\S+$/i.test(trimmed)
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function raceLabel(race) {
  return `${race.season} · R${race.round} · ${race.name}`
}

function sortRaces(races) {
  return [...races].sort((a, b) => (b.season - a.season) || (b.round - a.round))
}

export default function AdminRaces() {
  useDocumentTitle('Админ — Гонки')
  const toast = useToast()
  const [races, setRaces] = useState([])
  const [seasons, setSeasons] = useState([])
  const [seasonFilter, setSeasonFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [pendingId, setPendingId] = useState(null)

  // После бэкфилла истории в БД 500+ гонок: грузим только выбранный сезон,
  // а не все результаты разом.
  useEffect(() => {
    let cancelled = false
    api.get('/history/seasons')
      .then(({ data }) => {
        if (cancelled) return
        const list = data.data || []
        setSeasons(list)
        setSeasonFilter(String(list[0]?.season ?? new Date().getFullYear()))
      })
      .catch(() => {
        if (cancelled) return
        setSeasons([])
        setSeasonFilter(String(new Date().getFullYear()))
      })
    return () => { cancelled = true }
  }, [])

  const loadSeason = useCallback(async (season) => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/races', { params: { season } })
      setRaces(sortRaces(data.data || []))
    } catch {
      setError('Не удалось загрузить гонки')
      setRaces([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (seasonFilter) loadSeason(seasonFilter)
  }, [seasonFilter, loadSeason])

  const visibleRaces = races

  const rememberSeason = (season) => {
    const value = Number(season)
    setSeasons(prev => [...new Set([...prev, value])].sort((a, b) => b - a))
  }

  const addRace = async (form) => {
    try {
      const { data } = await api.post('/races', {
        ...form,
        season: Number(form.season),
        round: Number(form.round),
      })
      const created = data.data
      rememberSeason(created.season)
      if (String(created.season) !== seasonFilter) {
        setSeasonFilter(String(created.season))
      } else {
        setRaces(prev => sortRaces([...prev, created]))
      }
      toast.success('Гонка добавлена')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Не удалось добавить гонку')
    }
  }

  const updateRace = async (id, form, previous) => {
    const patch = {
      ...form,
      season: Number(form.season),
      round: Number(form.round),
      broadcastUrl: form.broadcastUrl.trim() || null,
    }
    setRaces(prev => sortRaces(prev.map(r => (r.id === id ? { ...r, ...patch } : r))))
    try {
      const { data } = await api.put(`/races/${id}`, patch)
      rememberSeason(data.data.season)
      if (String(data.data.season) !== seasonFilter) {
        setSeasonFilter(String(data.data.season))
      } else {
        setRaces(prev => sortRaces(prev.map(r => (r.id === id ? data.data : r))))
      }
      toast.success('Гонка обновлена')
    } catch (err) {
      setRaces(prev => sortRaces(prev.map(r => (r.id === id ? previous : r))))
      toast.error(err.response?.data?.error || 'Не удалось обновить гонку')
    }
  }

  const deleteRace = async (id) => {
    const previous = races
    setPendingId(id)
    setRaces(prev => prev.filter(r => r.id !== id))
    try {
      await api.delete(`/races/${id}`)
      toast.success('Гонка удалена (включая документ прогнозов в MongoDB)')
    } catch (err) {
      setRaces(previous)
      toast.error(err.response?.data?.error || 'Не удалось удалить гонку')
    }
    setPendingId(null)
  }

  const requestDelete = (race) => {
    setConfirm({
      title: 'Удалить гонку?',
      message: `«${raceLabel(race)}» будет удалена вместе с результатами и документом народного прогноза в MongoDB. Действие необратимо.`,
      confirmLabel: 'Удалить',
      variant: 'danger',
      action: () => deleteRace(race.id),
    })
  }

  const runConfirm = async () => {
    if (!confirm) return
    const action = confirm.action
    setConfirm(null)
    await action()
  }

  if (loading && !seasonFilter) return <Spinner label="Загрузка гонок…" />

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="mb-4 text-sm font-medium text-red-500">{error}</p>
        <Button onClick={() => loadSeason(seasonFilter)}>Повторить</Button>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-foreground dark:text-foreground-dark">
            Гонки <span className="font-mono text-sm text-muted dark:text-muted-dark">({visibleRaces.length})</span>
          </h2>
          <Select label="Сезон" value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)}>
            {seasons.map(s => (
              <option key={s} value={String(s)}>{s}</option>
            ))}
          </Select>
        </div>

        {loading ? (
          <Spinner label="Загрузка гонок…" />
        ) : visibleRaces.length === 0 ? (
          <Card className="border-dashed p-8 text-center text-muted dark:text-muted-dark">Нет гонок</Card>
        ) : (
          <div className="space-y-3">
            {visibleRaces.map(race => (
              <RaceRow
                key={race.id}
                race={race}
                pending={pendingId === race.id}
                onUpdate={updateRace}
                onDelete={requestDelete}
              />
            ))}
          </div>
        )}
      </section>

      <aside>
        <AddRaceForm onAdd={addRace} defaultSeason={seasonFilter} />
      </aside>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        variant={confirm?.variant}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}

function RaceRow({ race, pending, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: race.name,
    circuit: race.circuit || '',
    country: race.country || '',
    date: race.date || '',
    season: race.season,
    round: race.round,
    status: race.status,
    trackLatitude: race.trackLatitude ?? '',
    trackLongitude: race.trackLongitude ?? '',
    broadcastUrl: race.broadcastUrl || '',
  })

  const badge = STATUS_BADGES[race.status] || STATUS_BADGES.scheduled

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  const handleSave = () => {
    onUpdate(race.id, form, race)
    setEditing(false)
  }

  if (editing) {
    return (
      <Card className="p-4">
        <p className="mb-3 text-sm font-bold text-primary dark:text-accent">
          Редактирование — {raceLabel(race)}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Input label="Название" name="name" value={form.name} onChange={handleChange} />
          </div>
          <Input label="Трасса" name="circuit" value={form.circuit} onChange={handleChange} />
          <Input label="Страна" name="country" value={form.country} onChange={handleChange} />
          <Input label="Дата" type="date" name="date" value={form.date} onChange={handleChange} />
          <Select label="Статус" name="status" value={form.status} onChange={handleChange}>
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
          <Input label="Широта трассы" type="number" step="0.000001" name="trackLatitude" value={form.trackLatitude} onChange={handleChange} />
          <Input label="Долгота трассы" type="number" step="0.000001" name="trackLongitude" value={form.trackLongitude} onChange={handleChange} />
          <div className="col-span-2">
            <Input
              label="Ссылка на трансляцию"
              name="broadcastUrl"
              value={form.broadcastUrl}
              onChange={handleChange}
              placeholder="https://…"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button size="sm" onClick={handleSave}>Сохранить</Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Отмена</Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-bold text-foreground dark:text-foreground-dark">
            {race.name}
          </h3>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badge}`}>
            {STATUS_LABELS[race.status] || race.status}
          </span>
        </div>
        <p className="mt-1 truncate text-sm text-muted dark:text-muted-dark">
          {race.season} · Этап {race.round} · {formatDate(race.date)}
          {race.circuit ? ` · ${race.circuit}` : ''}
        </p>
        {race.broadcastUrl && (
          <a
            href={race.broadcastUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block truncate text-xs font-semibold text-primary underline hover:text-primary-hover dark:text-accent"
          >
            📺 {race.broadcastUrl}
          </a>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditing(true)}>Изменить</Button>
        <Button size="sm" variant="danger" disabled={pending} onClick={() => onDelete(race)}>Удалить</Button>
      </div>
    </Card>
  )
}

function AddRaceForm({ onAdd, defaultSeason }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, season: defaultSeason || '' })
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(prev => ({ ...prev, season: defaultSeason || prev.season }))
  }, [defaultSeason])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    setError('')
  }

  const handleSubmit = () => {
    if (!form.name.trim()) {
      setError('Введите название Гран-при.')
      return
    }
    if (!form.season || Number(form.season) < 1950) {
      setError('Введите корректный сезон (год ≥ 1950).')
      return
    }
    if (!form.round || Number(form.round) < 1) {
      setError('Введите корректный номер этапа.')
      return
    }
    if (!isValidBroadcastUrl(form.broadcastUrl)) {
      setError('Ссылка на трансляцию должна начинаться с http:// или https://.')
      return
    }

    onAdd(form)
    setForm({ ...EMPTY_FORM, season: defaultSeason || '' })
  }

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-lg font-bold text-foreground dark:text-foreground-dark">Новая гонка</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Input label="Название" name="name" value={form.name} onChange={handleChange} placeholder="Monaco Grand Prix" />
        </div>
        <Input label="Сезон" type="number" name="season" value={form.season} onChange={handleChange} min={1950} />
        <Input label="Этап" type="number" name="round" value={form.round} onChange={handleChange} min={1} />
        <Input label="Дата" type="date" name="date" value={form.date} onChange={handleChange} />
        <Select label="Статус" name="status" value={form.status} onChange={handleChange}>
          {STATUS_OPTIONS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>
        <div className="col-span-2">
          <Input label="Трасса" name="circuit" value={form.circuit} onChange={handleChange} />
        </div>
        <Input label="Страна" name="country" value={form.country} onChange={handleChange} />
        <Input label="Широта трассы" type="number" step="0.000001" name="trackLatitude" value={form.trackLatitude} onChange={handleChange} />
        <Input label="Долгота трассы" type="number" step="0.000001" name="trackLongitude" value={form.trackLongitude} onChange={handleChange} />
        <div className="col-span-2">
          <Input
            label="Ссылка на трансляцию"
            name="broadcastUrl"
            value={form.broadcastUrl}
            onChange={handleChange}
            placeholder="https://…"
          />
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-sm font-medium text-red-500" role="alert">
          {error}
        </p>
      )}

      <Button className="mt-4 w-full" onClick={handleSubmit}>Добавить гонку</Button>
    </Card>
  )
}
