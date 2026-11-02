import useDocumentTitle from '../../hooks/useDocumentTitle'
import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Input from '../../components/ui/Input'
import Spinner from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/useToast'

const EMPTY_FORM = {
  name: '',
  principal: '',
  nationality: '',
  url: '',
  color: '#0ea5e9',
}

const FILTERS = [
  { value: 'active', label: 'Активные' },
  { value: 'archived', label: 'Архивные' },
  { value: 'all', label: 'Все' },
]

export default function AdminTeams() {
  useDocumentTitle('Админ — Команды')
  const toast = useToast()
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('active')
  const [confirm, setConfirm] = useState(null)
  const [pendingId, setPendingId] = useState(null)

  const loadTeams = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/admin/teams')
      setTeams(data.data || [])
    } catch {
      setError('Не удалось загрузить команды')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadTeams()
  }, [loadTeams])

  const visibleTeams = useMemo(() => {
    if (filter === 'active') return teams.filter(t => t.isActive !== false)
    if (filter === 'archived') return teams.filter(t => t.isActive === false)
    return teams
  }, [teams, filter])

  const counts = useMemo(() => ({
    all: teams.length,
    active: teams.filter(t => t.isActive !== false).length,
    archived: teams.filter(t => t.isActive === false).length,
  }), [teams])

  const addTeam = async (form) => {
    const tempId = `temp-${Date.now()}`
    const optimistic = { id: tempId, ...form, isActive: true, drivers: [] }
    setTeams(prev => [...prev, optimistic])
    try {
      const { data } = await api.post('/teams', form)
      setTeams(prev => prev.map(t => (t.id === tempId ? data.data : t)))
      toast.success('Команда добавлена')
    } catch (err) {
      setTeams(prev => prev.filter(t => t.id !== tempId))
      toast.error(err.response?.data?.error || 'Не удалось добавить команду')
    }
  }

  const updateTeam = async (id, form) => {
    const previous = teams.find(t => t.id === id)
    setTeams(prev => prev.map(t => (t.id === id ? { ...t, ...form, id } : t)))
    try {
      const { data } = await api.put(`/teams/${id}`, form)
      setTeams(prev => prev.map(t => (t.id === id ? data.data : t)))
      toast.success('Команда обновлена')
    } catch (err) {
      setTeams(prev => prev.map(t => (t.id === id ? previous : t)))
      toast.error(err.response?.data?.error || 'Не удалось обновить команду')
    }
  }

  const setActive = async (team, isActive) => {
    const previous = teams
    setPendingId(team.id)
    setTeams(prev => prev.map(t => (t.id === team.id ? { ...t, isActive } : t)))
    try {
      const { data } = await api.put(`/teams/${team.id}`, { isActive })
      setTeams(prev => prev.map(t => (t.id === team.id ? data.data : t)))
      toast.success(isActive ? 'Команда возвращена из архива' : 'Команда архивирована')
    } catch (err) {
      setTeams(previous)
      toast.error(err.response?.data?.error || 'Не удалось изменить статус команды')
    }
    setPendingId(null)
  }

  const deleteTeam = async (id) => {
    const previous = teams.find(t => t.id === id)
    const index = teams.findIndex(t => t.id === id)
    setPendingId(id)
    setTeams(prev => prev.filter(t => t.id !== id))
    try {
      await api.delete(`/teams/${id}`)
      toast.success('Команда удалена')
    } catch (err) {
      setTeams(prev => {
        const next = [...prev]
        next.splice(Math.min(index, next.length), 0, previous)
        return next
      })
      toast.error(err.response?.data?.error || 'Не удалось удалить команду')
    }
    setPendingId(null)
  }

  const requestDelete = (team) => {
    setConfirm({
      title: 'Удалить команду?',
      message: `«${team.name}» будет удалена. Если у команды есть результаты гран-при, удаление заблокируется — тогда используйте «Архивировать».`,
      confirmLabel: 'Удалить',
      variant: 'danger',
      action: () => deleteTeam(team.id),
    })
  }

  const requestArchive = (team) => {
    setConfirm({
      title: 'Архивировать команду?',
      message: `«${team.name}» скроется из публичных разделов, результаты сохранятся. Вернуть можно кнопкой «Вернуть».`,
      confirmLabel: 'Архивировать',
      variant: 'outline',
      action: () => setActive(team, false),
    })
  }

  const runConfirm = async () => {
    if (!confirm) return
    const action = confirm.action
    setConfirm(null)
    await action()
  }

  if (loading) return <Spinner label="Загрузка команд…" />

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="mb-4 text-sm font-medium text-red-500">{error}</p>
        <Button onClick={loadTeams}>Повторить</Button>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-foreground dark:text-foreground-dark">
            Команды <span className="font-mono text-sm text-muted dark:text-muted-dark">({visibleTeams.length})</span>
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

        {visibleTeams.length === 0 ? (
          <Card className="border-dashed p-8 text-center text-muted dark:text-muted-dark">Нет команд</Card>
        ) : (
          <div className="space-y-3">
            {visibleTeams.map(t => (
              <TeamRow
                key={t.id}
                team={t}
                pending={pendingId === t.id}
                onUpdate={updateTeam}
                onDelete={requestDelete}
                onArchive={requestArchive}
                onRestore={(team) => setActive(team, true)}
              />
            ))}
          </div>
        )}
      </section>

      <aside>
        <AddTeamForm onAdd={addTeam} />
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

function TeamRow({ team, pending, onUpdate, onDelete, onArchive, onRestore }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: team.name || '',
    principal: team.principal || '',
    nationality: team.nationality || '',
    url: team.url || '',
    color: team.color || '#0ea5e9',
  })

  const archived = team.isActive === false
  const color = team.color || '#0ea5e9'

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  const handleSave = () => {
    if (!form.name.trim()) return
    onUpdate(team.id, form)
    setEditing(false)
  }

  if (editing) {
    return (
      <Card className="p-4">
        <p className="mb-3 text-sm font-bold text-primary dark:text-accent">Редактирование</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Название" name="name" value={form.name} onChange={handleChange} />
          <Input label="Руководитель" name="principal" value={form.principal} onChange={handleChange} />
          <Input label="Национальность" name="nationality" value={form.nationality} onChange={handleChange} />
          <Input label="Цвет" type="color" name="color" value={form.color} onChange={handleChange} />
          <div className="col-span-2">
            <Input label="URL" name="url" value={form.url} onChange={handleChange} placeholder="https://…" />
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
          <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="truncate font-bold text-foreground dark:text-foreground-dark">{team.name}</h3>
          {archived && (
            <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
              Архив
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-sm text-muted dark:text-muted-dark">
          {[team.principal, team.nationality].filter(Boolean).join(' · ')}
          {team.drivers?.length ? ` · пилотов: ${team.drivers.length}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditing(true)}>Изменить</Button>
        {archived ? (
          <Button size="sm" variant="primary" disabled={pending} onClick={() => onRestore(team)}>Вернуть</Button>
        ) : (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => onArchive(team)}>Архивировать</Button>
        )}
        <Button size="sm" variant="danger" disabled={pending} onClick={() => onDelete(team)}>Удалить</Button>
      </div>
    </Card>
  )
}

function AddTeamForm({ onAdd }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    setError('')
  }

  const handleSubmit = () => {
    if (!form.name.trim()) {
      setError('Укажите название команды.')
      return
    }
    onAdd(form)
    setForm(EMPTY_FORM)
  }

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-lg font-bold text-foreground dark:text-foreground-dark">Новая команда</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Input label="Название" name="name" value={form.name} onChange={handleChange} />
        </div>
        <Input label="Руководитель" name="principal" value={form.principal} onChange={handleChange} />
        <Input label="Национальность" name="nationality" value={form.nationality} onChange={handleChange} />
        <Input label="Цвет" type="color" name="color" value={form.color} onChange={handleChange} />
        <div className="col-span-2">
          <Input label="URL" name="url" value={form.url} onChange={handleChange} placeholder="https://…" />
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-sm font-medium text-red-500" role="alert">
          {error}
        </p>
      )}

      <Button className="mt-4 w-full" onClick={handleSubmit}>Добавить команду</Button>
    </Card>
  )
}
