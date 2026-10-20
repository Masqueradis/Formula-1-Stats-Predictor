import useDocumentTitle from '../../hooks/useDocumentTitle'
import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Spinner from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  abbreviation: '',
  number: '',
  nationality: '',
  podiums: 0,
  imageUrl: '',
  teamId: '',
}

const FILTERS = [
  { value: 'active', label: 'Активные' },
  { value: 'archived', label: 'Архивные' },
  { value: 'all', label: 'Все' },
]

export default function AdminDrivers() {
  useDocumentTitle('Админ — Пилоты')
  const toast = useToast()
  const [drivers, setDrivers] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('active')
  const [confirm, setConfirm] = useState(null)
  const [pendingId, setPendingId] = useState(null)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [dRes, tRes] = await Promise.all([api.get('/admin/drivers'), api.get('/teams')])
      setDrivers(dRes.data.data || [])
      setTeams(tRes.data.data || [])
    } catch {
      setError('Не удалось загрузить данные')
    }
    setLoading(false)
  }, [])

  const visibleDrivers = useMemo(() => {
    if (filter === 'active') return drivers.filter(d => d.isActive !== false)
    if (filter === 'archived') return drivers.filter(d => d.isActive === false)
    return drivers
  }, [drivers, filter])

  const counts = useMemo(() => ({
    all: drivers.length,
    active: drivers.filter(d => d.isActive !== false).length,
    archived: drivers.filter(d => d.isActive === false).length,
  }), [drivers])

  const addDriver = async (form) => {
    const tempId = `temp-${Date.now()}`
    const optimistic = {
      id: tempId,
      firstName: form.firstName,
      lastName: form.lastName,
      abbreviation: form.abbreviation,
      number: Number(form.number),
      nationality: form.nationality,
      podiums: Number(form.podiums) || 0,
      imageUrl: form.imageUrl || null,
      isActive: true,
      team: teams.find(t => Number(t.id) === Number(form.teamId)) || null,
    }

    setDrivers(prev => [...prev, optimistic])
    try {
      const { data } = await api.post('/drivers', { ...form, number: Number(form.number) })
      setDrivers(prev => prev.map(d => (d.id === tempId ? data.data : d)))
      toast.success('Пилот добавлен')
    } catch (err) {
      setDrivers(prev => prev.filter(d => d.id !== tempId))
      toast.error(err.response?.data?.error || 'Не удалось добавить пилота')
    }
  }

  const updateDriver = async (id, form, team) => {
    const previous = drivers.find(d => d.id === id)
    const patch = {
      firstName: form.firstName,
      lastName: form.lastName,
      abbreviation: form.abbreviation,
      number: Number(form.number),
      nationality: form.nationality,
      podiums: Number(form.podiums) || 0,
      imageUrl: form.imageUrl || null,
      team: team || previous?.team || null,
    }

    setDrivers(prev => prev.map(d => (d.id === id ? { ...d, ...patch, id } : d)))
    try {
      const { data } = await api.put(`/drivers/${id}`, { ...form, number: Number(form.number) })
      setDrivers(prev => prev.map(d => (d.id === id ? data.data : d)))
      toast.success('Пилот обновлён')
    } catch (err) {
      setDrivers(prev => prev.map(d => (d.id === id ? previous : d)))
      toast.error(err.response?.data?.error || 'Не удалось обновить пилота')
    }
  }

  const setActive = async (driver, isActive) => {
    const previous = drivers
    setPendingId(driver.id)
    setDrivers(prev => prev.map(d => (d.id === driver.id ? { ...d, isActive } : d)))
    try {
      const { data } = await api.put(`/drivers/${driver.id}`, { isActive })
      setDrivers(prev => prev.map(d => (d.id === driver.id ? data.data : d)))
      toast.success(isActive ? 'Пилот возвращён из архива' : 'Пилот архивирован')
    } catch (err) {
      setDrivers(previous)
      toast.error(err.response?.data?.error || 'Не удалось изменить статус пилота')
    }
    setPendingId(null)
  }

  const deleteDriver = async (id) => {
    const previous = drivers.find(d => d.id === id)
    const index = drivers.findIndex(d => d.id === id)
    setPendingId(id)
    setDrivers(prev => prev.filter(d => d.id !== id))
    try {
      await api.delete(`/drivers/${id}`)
      toast.success('Пилот удалён')
    } catch (err) {
      setDrivers(prev => {
        const next = [...prev]
        next.splice(Math.min(index, next.length), 0, previous)
        return next
      })
      toast.error(err.response?.data?.error || 'Не удалось удалить пилота')
    }
    setPendingId(null)
  }

  const requestDelete = (driver) => {
    setConfirm({
      title: 'Удалить пилота?',
      message: `«${driver.firstName} ${driver.lastName}» будет удалён. Если у пилота есть результаты гран-при, удаление заблокируется — тогда используйте «Архивировать».`,
      confirmLabel: 'Удалить',
      variant: 'danger',
      action: () => deleteDriver(driver.id),
    })
  }

  const requestArchive = (driver) => {
    setConfirm({
      title: 'Архивировать пилота?',
      message: `«${driver.firstName} ${driver.lastName}» скроется из публичных разделов, результаты сохранятся. Вернуть можно кнопкой «Вернуть».`,
      confirmLabel: 'Архивировать',
      variant: 'outline',
      action: () => setActive(driver, false),
    })
  }

  const runConfirm = async () => {
    if (!confirm) return
    const action = confirm.action
    setConfirm(null)
    await action()
  }

  if (loading) return <Spinner label="Загрузка пилотов…" />

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="mb-4 text-sm font-medium text-red-500">{error}</p>
        <Button onClick={loadAll}>Повторить</Button>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-foreground dark:text-foreground-dark">
            Пилоты <span className="font-mono text-sm text-muted dark:text-muted-dark">({visibleDrivers.length})</span>
          </h2>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map(f => (
              <Button
                key={f.value}
                size="sm"
                variant={filter === f.value ? 'primary' : 'outline'}
                onClick={() => setFilter(f.value)}
              >
                {f.label} <span className="font-mono text-xs opacity-70">{counts[f.value]}</span>
              </Button>
            ))}
          </div>
        </div>

        {visibleDrivers.length === 0 ? (
          <Card className="border-dashed p-8 text-center text-muted dark:text-muted-dark">Нет пилотов</Card>
        ) : (
          <div className="space-y-3">
            {visibleDrivers.map(d => (
              <DriverRow
                key={d.id}
                driver={d}
                teams={teams}
                pending={pendingId === d.id}
                onUpdate={updateDriver}
                onDelete={requestDelete}
                onArchive={requestArchive}
                onRestore={(driver) => setActive(driver, true)}
              />
            ))}
          </div>
        )}
      </section>

      <aside>
        <AddDriverForm teams={teams} onAdd={addDriver} />
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

function DriverRow({ driver, teams, pending, onUpdate, onDelete, onArchive, onRestore }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    firstName: driver.firstName,
    lastName: driver.lastName,
    abbreviation: driver.abbreviation,
    number: driver.number,
    nationality: driver.nationality,
    podiums: driver.podiums || 0,
    imageUrl: driver.imageUrl || '',
    teamId: driver.team?.id || '',
  })

  const archived = driver.isActive === false
  const teamColor = driver.team?.color || '#0ea5e9'

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: name === 'abbreviation' ? value.toUpperCase() : value }))
  }

  const handleSave = () => {
    const team = teams.find(t => Number(t.id) === Number(form.teamId)) || null
    onUpdate(driver.id, form, team)
    setEditing(false)
  }

  if (editing) {
    return (
      <Card className="p-4">
        <p className="mb-3 text-sm font-bold text-primary dark:text-accent">Редактирование</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Имя" name="firstName" value={form.firstName} onChange={handleChange} />
          <Input label="Фамилия" name="lastName" value={form.lastName} onChange={handleChange} />
          <Input label="Аббр. (3)" name="abbreviation" maxLength={3} value={form.abbreviation} onChange={handleChange} />
          <Input label="Номер" type="number" name="number" value={form.number} onChange={handleChange} />
          <Input label="Национальность" name="nationality" value={form.nationality} onChange={handleChange} />
          <Input label="Подиумы" type="number" name="podiums" value={form.podiums} onChange={handleChange} min={0} />
          <div className="col-span-2">
            <Input label="imageUrl" name="imageUrl" value={form.imageUrl} onChange={handleChange} placeholder="https://…" />
          </div>
          <div className="col-span-2">
            <Select label="Команда" name="teamId" value={form.teamId} onChange={handleChange}>
              <option value="">— без команды —</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
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
    <Card className={`flex items-center justify-between gap-4 p-4 ${archived ? 'opacity-80' : ''}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-mono text-xs font-black italic text-white" style={{ backgroundColor: teamColor }}>
            {driver.abbreviation}
          </span>
          <h3 className="truncate font-bold text-foreground dark:text-foreground-dark">
            {driver.firstName} {driver.lastName}
          </h3>
          {archived && (
            <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
              Архив
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-sm text-muted dark:text-muted-dark">
          {driver.nationality} · №{driver.number} · подиумы: {driver.podiums || 0}
          {driver.team ? ` · ${driver.team.name}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditing(true)}>Изменить</Button>
        {archived ? (
          <Button size="sm" variant="primary" disabled={pending} onClick={() => onRestore(driver)}>Вернуть</Button>
        ) : (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => onArchive(driver)}>Архивировать</Button>
        )}
        <Button size="sm" variant="danger" disabled={pending} onClick={() => onDelete(driver)}>Удалить</Button>
      </div>
    </Card>
  )
}

function AddDriverForm({ teams, onAdd }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: name === 'abbreviation' ? value.toUpperCase() : value }))
    setError('')
  }

  const handleSubmit = () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.nationality.trim()) {
      setError('Заполните имя, фамилию и национальность.')
      return
    }
    if (!/^[A-Z]{3}$/.test(form.abbreviation)) {
      setError('Аббревиатура — ровно 3 заглавные латинские буквы (например VER).')
      return
    }
    if (!form.number || Number(form.number) < 1) {
      setError('Введите корректный номер болида.')
      return
    }

    onAdd(form)
    setForm(EMPTY_FORM)
  }

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-lg font-bold text-foreground dark:text-foreground-dark">Новый пилот</h2>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Имя" name="firstName" value={form.firstName} onChange={handleChange} />
        <Input label="Фамилия" name="lastName" value={form.lastName} onChange={handleChange} />
        <Input label="Аббревиатура (3)" maxLength={3} name="abbreviation" value={form.abbreviation} onChange={handleChange} />
        <Input label="Номер болида" type="number" name="number" value={form.number} onChange={handleChange} min={1} />
        <Input label="Национальность" name="nationality" value={form.nationality} onChange={handleChange} />
        <Input label="Подиумы" type="number" name="podiums" value={form.podiums} onChange={handleChange} min={0} />
        <div className="col-span-2">
          <Input label="imageUrl" name="imageUrl" value={form.imageUrl} onChange={handleChange} placeholder="https://…" />
        </div>
        <div className="col-span-2">
          <Select label="Команда" name="teamId" value={form.teamId} onChange={handleChange}>
            <option value="">— без команды —</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-sm font-medium text-red-500" role="alert">
          {error}
        </p>
      )}

      <Button className="mt-4 w-full" onClick={handleSubmit}>Добавить пилота</Button>
    </Card>
  )
}
