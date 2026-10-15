import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Spinner from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'

const EMPTY_ADD = {
  raceId: '',
  sessionType: 'race',
  position: '',
  points: '',
  grid: '',
  fastestLap: false,
}

const SESSION_LABELS = { race: 'Гонка', sprint: 'Спринт' }

function raceLabel(race) {
  if (!race) return '—'
  return `${race.season} · R${race.round} · ${race.name}`
}

function sortRaces(races) {
  return [...races].sort((a, b) => (b.season - a.season) || (b.round - a.round))
}

export default function AdminResults() {
  const toast = useToast()
  const [drivers, setDrivers] = useState([])
  const [races, setRaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [driverId, setDriverId] = useState('')
  const [results, setResults] = useState([])
  const [loadingResults, setLoadingResults] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [addForm, setAddForm] = useState(EMPTY_ADD)
  const [confirm, setConfirm] = useState(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    loadBase()
  }, [])

  const loadBase = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [dRes, rRes] = await Promise.all([api.get('/drivers'), api.get('/races')])
      setDrivers(dRes.data.data || [])
      setRaces(sortRaces(rRes.data.data || []))
    } catch {
      setError('Не удалось загрузить данные')
    }
    setLoading(false)
  }, [])

  const loadResults = useCallback(async (id) => {
    if (!id) {
      setResults([])
      return
    }
    setLoadingResults(true)
    try {
      const { data } = await api.get('/race-results', { params: { driverId: id } })
      setResults(data.data || [])
    } catch {
      setResults([])
      toast.error('Не удалось загрузить результаты')
    }
    setLoadingResults(false)
  }, [toast])

  useEffect(() => {
    loadResults(driverId)
  }, [driverId, loadResults])

  const selectedDriver = useMemo(
    () => drivers.find(d => String(d.id) === String(driverId)) || null,
    [drivers, driverId],
  )

  const addResult = async () => {
    if (!driverId) {
      toast.error('Сначала выберите пилота')
      return
    }
    if (!addForm.raceId) {
      toast.error('Выберите гонку')
      return
    }
    const position = addForm.position === '' ? null : Number(addForm.position)
    if (position !== null && (!Number.isInteger(position) || position < 1)) {
      toast.error('Позиция — целое число ≥ 1')
      return
    }

    setPending(true)
    try {
      await api.post('/race-results', {
        raceId: Number(addForm.raceId),
        driverId: Number(driverId),
        sessionType: addForm.sessionType,
        position,
        points: addForm.points === '' ? null : Number(addForm.points),
        grid: addForm.grid === '' ? null : Number(addForm.grid),
        fastestLap: addForm.fastestLap,
      })
      toast.success('Результат добавлен')
      setAddForm(EMPTY_ADD)
      await loadResults(driverId)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Не удалось добавить результат')
    }
    setPending(false)
  }

  const startEdit = (result) => {
    setEditingId(result.id)
    setEditForm({
      sessionType: result.sessionType,
      position: result.position ?? '',
      points: result.points ?? '',
      grid: result.grid ?? '',
      fastestLap: Boolean(result.fastestLap),
    })
  }

  const saveEdit = async (id) => {
    const position = editForm.position === '' ? null : Number(editForm.position)
    if (position !== null && (!Number.isInteger(position) || position < 1)) {
      toast.error('Позиция — целое число ≥ 1')
      return
    }
    setPending(true)
    try {
      await api.put(`/race-results/${id}`, {
        sessionType: editForm.sessionType,
        position,
        points: editForm.points === '' ? null : Number(editForm.points),
        grid: editForm.grid === '' ? null : Number(editForm.grid),
        fastestLap: Boolean(editForm.fastestLap),
      })
      toast.success('Результат обновлён')
      setEditingId(null)
      await loadResults(driverId)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Не удалось обновить результат')
    }
    setPending(false)
  }

  const deleteResult = async (id) => {
    setPending(true)
    try {
      await api.delete(`/race-results/${id}`)
      toast.success('Результат удалён')
      await loadResults(driverId)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Не удалось удалить результат')
    }
    setPending(false)
  }

  const requestDelete = (result) => {
    setConfirm({
      title: 'Удалить результат?',
      message: `${raceLabel(result.race)} · ${SESSION_LABELS[result.sessionType] || result.sessionType}. Подиумы пилота будут пересчитаны.`,
      confirmLabel: 'Удалить',
      variant: 'danger',
      action: () => deleteResult(result.id),
    })
  }

  const runConfirm = async () => {
    if (!confirm) return
    const action = confirm.action
    setConfirm(null)
    await action()
  }

  if (loading) return <Spinner label="Загрузка данных…" />

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="mb-4 text-sm font-medium text-red-500">{error}</p>
        <Button onClick={loadBase}>Повторить</Button>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-l-4 border-amber-500 p-4 text-sm text-muted dark:text-muted-dark">
        Внимание: синхронизация данных (кнопка «Синхронизировать» или cron) перезаписывает результаты
        гонок для сезона. Ручные правки будут потеряны после синка.
      </Card>

      <Card className="p-5">
        <div className="grid gap-3 sm:grid-cols-[280px_1fr] sm:items-end">
          <Select label="Пилот" value={driverId} onChange={e => setDriverId(e.target.value)}>
            <option value="">— выберите пилота —</option>
            {drivers.map(d => (
              <option key={d.id} value={d.id}>
                {d.firstName} {d.lastName} ({d.abbreviation})
              </option>
            ))}
          </Select>
          {selectedDriver && (
            <p className="text-sm text-muted dark:text-muted-dark">
              Подиумы (в БД): <span className="font-mono font-bold text-foreground dark:text-foreground-dark">{selectedDriver.podiums || 0}</span>
            </p>
          )}
        </div>
      </Card>

      {!driverId ? (
        <Card className="border-dashed p-8 text-center text-muted dark:text-muted-dark">
          Выберите пилота, чтобы увидеть и отредактировать его результаты.
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section>
            <h2 className="mb-4 text-lg font-bold text-foreground dark:text-foreground-dark">
              Результаты <span className="font-mono text-sm text-muted dark:text-muted-dark">({results.length})</span>
            </h2>
            {loadingResults ? (
              <Spinner label="Загрузка результатов…" />
            ) : results.length === 0 ? (
              <Card className="border-dashed p-8 text-center text-muted dark:text-muted-dark">Нет результатов</Card>
            ) : (
              <div className="space-y-3">
                {results.map(r => (
                  <ResultRow
                    key={r.id}
                    result={r}
                    editing={editingId === r.id}
                    form={editForm}
                    setForm={setEditForm}
                    pending={pending}
                    onStartEdit={() => startEdit(r)}
                    onCancelEdit={() => setEditingId(null)}
                    onSave={() => saveEdit(r.id)}
                    onDelete={() => requestDelete(r)}
                  />
                ))}
              </div>
            )}
          </section>

          <aside>
            <AddResultForm
              form={addForm}
              setForm={setAddForm}
              races={races}
              pending={pending}
              onSubmit={addResult}
            />
          </aside>
        </div>
      )}

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

function ResultRow({ result, editing, form, setForm, pending, onStartEdit, onCancelEdit, onSave, onDelete }) {
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  if (editing) {
    return (
      <Card className="p-4">
        <p className="mb-3 text-sm font-bold text-primary dark:text-accent">{raceLabel(result.race)}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Select label="Сессия" name="sessionType" value={form.sessionType} onChange={handleChange}>
            <option value="race">Гонка</option>
            <option value="sprint">Спринт</option>
          </Select>
          <Input label="Позиция" type="number" name="position" value={form.position} onChange={handleChange} min={1} />
          <Input label="Очки" type="number" step="0.5" name="points" value={form.points} onChange={handleChange} min={0} />
          <Input label="Старт" type="number" name="grid" value={form.grid} onChange={handleChange} min={1} />
          <label className="col-span-2 flex items-center gap-2 text-sm text-muted dark:text-muted-dark sm:col-span-4">
            <input type="checkbox" name="fastestLap" checked={form.fastestLap} onChange={handleChange} />
            Быстрый круг
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <Button size="sm" onClick={onSave} disabled={pending}>Сохранить</Button>
          <Button size="sm" variant="outline" onClick={onCancelEdit} disabled={pending}>Отмена</Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <h3 className="truncate font-bold text-foreground dark:text-foreground-dark">{raceLabel(result.race)}</h3>
        <p className="mt-1 text-sm text-muted dark:text-muted-dark">
          <span className="font-semibold">{SESSION_LABELS[result.sessionType] || result.sessionType}</span>
          {' · '}Поз: {result.position ?? '—'}
          {' · '}Очки: {result.points ?? '—'}
          {result.grid != null ? ` · Старт: ${result.grid}` : ''}
          {result.fastestLap ? ' · Быстрый круг' : ''}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" onClick={onStartEdit} disabled={pending}>Изменить</Button>
        <Button size="sm" variant="danger" onClick={onDelete} disabled={pending}>Удалить</Button>
      </div>
    </Card>
  )
}

function AddResultForm({ form, setForm, races, pending, onSubmit }) {
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-lg font-bold text-foreground dark:text-foreground-dark">Новый результат</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Select label="Гонка" name="raceId" value={form.raceId} onChange={handleChange}>
            <option value="">— выберите гонку —</option>
            {races.map(r => (
              <option key={r.id} value={r.id}>{raceLabel(r)}</option>
            ))}
          </Select>
        </div>
        <Select label="Сессия" name="sessionType" value={form.sessionType} onChange={handleChange}>
          <option value="race">Гонка</option>
          <option value="sprint">Спринт</option>
        </Select>
        <Input label="Позиция" type="number" name="position" value={form.position} onChange={handleChange} min={1} />
        <Input label="Очки" type="number" step="0.5" name="points" value={form.points} onChange={handleChange} min={0} />
        <Input label="Старт" type="number" name="grid" value={form.grid} onChange={handleChange} min={1} />
        <label className="col-span-2 flex items-center gap-2 text-sm text-muted dark:text-muted-dark">
          <input type="checkbox" name="fastestLap" checked={form.fastestLap} onChange={handleChange} />
          Быстрый круг
        </label>
      </div>
      <Button className="mt-4 w-full" onClick={onSubmit} disabled={pending}>
        {pending ? 'Добавление…' : 'Добавить результат'}
      </Button>
    </Card>
  )
}
