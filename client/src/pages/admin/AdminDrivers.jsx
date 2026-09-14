import { useCallback, useEffect, useState } from 'react'
import api from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Spinner from '../../components/ui/Spinner'

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

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [dRes, tRes] = await Promise.all([api.get('/drivers'), api.get('/teams')])
      setDrivers(dRes.data.data || [])
      setTeams(tRes.data.data || [])
    } catch {
      setError('Не удалось загрузить данные')
    }
    setLoading(false)
  }, [])

  const showNotice = (msg) => {
    setNotice(msg)
    window.setTimeout(() => setNotice(''), 4000)
  }

  const handleError = (err, fallback) => {
    showNotice(err.response?.data?.error || fallback)
  }

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
      team: teams.find(t => Number(t.id) === Number(form.teamId)) || null,
    }

    setDrivers(prev => [...prev, optimistic])
    try {
      const { data } = await api.post('/drivers', { ...form, number: Number(form.number) })
      setDrivers(prev => prev.map(d => (d.id === tempId ? data.data : d)))
      showNotice('Пилот добавлен')
    } catch (err) {
      setDrivers(prev => prev.filter(d => d.id !== tempId))
      handleError(err, 'Не удалось добавить пилота')
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
      showNotice('Пилот обновлён')
    } catch (err) {
      setDrivers(prev => prev.map(d => (d.id === id ? previous : d)))
      handleError(err, 'Не удалось обновить пилота')
    }
  }

  const deleteDriver = async (id) => {
    const previous = drivers.find(d => d.id === id)
    const index = drivers.findIndex(d => d.id === id)
    setDrivers(prev => prev.filter(d => d.id !== id))
    try {
      await api.delete(`/drivers/${id}`)
      showNotice('Пилот удалён')
    } catch (err) {
      setDrivers(prev => {
        const next = [...prev]
        next.splice(Math.min(index, next.length), 0, previous)
        return next
      })
      handleError(err, 'Не удалось удалить пилота')
    }
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
      {notice && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-lg bg-card px-4 py-2 text-sm font-medium shadow-lg ring-1 ring-border-soft dark:bg-card-dark dark:ring-border-dark">
          {notice}
        </div>
      )}

      <section>
        <h2 className="mb-4 text-lg font-bold text-foreground dark:text-foreground-dark">
          Пилоты <span className="font-mono text-sm text-muted dark:text-muted-dark">({drivers.length})</span>
        </h2>
        {drivers.length === 0 ? (
          <Card className="border-dashed p-8 text-center text-muted dark:text-muted-dark">Нет пилотов</Card>
        ) : (
          <div className="space-y-3">
            {drivers.map(d => (
              <DriverRow
                key={d.id}
                driver={d}
                teams={teams}
                onUpdate={updateDriver}
                onDelete={deleteDriver}
              />
            ))}
          </div>
        )}
      </section>

      <aside>
        <AddDriverForm teams={teams} onAdd={addDriver} />
      </aside>
    </div>
  )
}

function DriverRow({ driver, teams, onUpdate, onDelete }) {
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
    <Card className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-mono text-xs font-black italic text-white" style={{ backgroundColor: teamColor }}>
            {driver.abbreviation}
          </span>
          <h3 className="truncate font-bold text-foreground dark:text-foreground-dark">
            {driver.firstName} {driver.lastName}
          </h3>
        </div>
        <p className="mt-1 truncate text-sm text-muted dark:text-muted-dark">
          {driver.nationality} · №{driver.number} · подиумы: {driver.podiums || 0}
          {driver.team ? ` · ${driver.team.name}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="xs" variant="outline" onClick={() => setEditing(true)}>Из</Button>
        <Button size="xs" variant="danger" onClick={() => onDelete(driver.id)}>Уд</Button>
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