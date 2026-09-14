import { useCallback, useEffect, useState } from 'react'
import api from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Spinner from '../../components/ui/Spinner'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/users')
      setUsers(data.data || [])
    } catch {
      setError('Не удалось загрузить пользователей')
    }
    setLoading(false)
  }, [])

  const deleteUser = async (id) => {
    const previous = users.find(u => u.id === id)
    const index = users.findIndex(u => u.id === id)
    setUsers(prev => prev.filter(u => u.id !== id))
    try {
      await api.delete(`/users/${id}`)
      setNotice('Пользователь удалён')
      window.setTimeout(() => setNotice(''), 4000)
    } catch (err) {
      setUsers(prev => {
        const next = [...prev]
        next.splice(Math.min(index, next.length), 0, previous)
        return next
      })
      setNotice(err.response?.data?.error || 'Не удалось удалить пользователя')
      window.setTimeout(() => setNotice(''), 4000)
    }
  }

  if (loading) return <Spinner label="Загрузка пользователей…" />

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="mb-4 text-sm font-medium text-red-500">{error}</p>
        <Button onClick={loadUsers}>Повторить</Button>
      </Card>
    )
  }

  return (
    <div>
      {notice && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-lg bg-card px-4 py-2 text-sm font-medium shadow-lg ring-1 ring-border-soft dark:bg-card-dark dark:ring-border-dark">
          {notice}
        </div>
      )}

      {users.length === 0 ? (
        <Card className="border-dashed p-8 text-center text-muted dark:text-muted-dark">Нет пользователей</Card>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <Card key={u.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-foreground dark:text-foreground-dark">{u.username}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    u.role === 'ADMIN' ? 'bg-accent/20 text-accent dark:bg-accent/30' : 'bg-primary/20 text-primary'
                  }`}>
                    {u.role}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm text-muted dark:text-muted-dark">{u.email}</p>
              </div>
              <Button size="xs" variant="danger" onClick={() => deleteUser(u.id)}>Удалить</Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}