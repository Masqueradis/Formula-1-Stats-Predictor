import useDocumentTitle from '../../hooks/useDocumentTitle'
import { useCallback, useEffect, useState } from 'react'
import api from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Spinner from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/useToast'

export default function AdminUsers() {
  useDocumentTitle('Админ — Пользователи')
  const toast = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [pendingId, setPendingId] = useState(null)

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

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const deleteUser = async (id) => {
    const previous = users.find(u => u.id === id)
    const index = users.findIndex(u => u.id === id)
    setPendingId(id)
    setUsers(prev => prev.filter(u => u.id !== id))
    try {
      await api.delete(`/users/${id}`)
      toast.success('Пользователь удалён')
    } catch (err) {
      setUsers(prev => {
        const next = [...prev]
        next.splice(Math.min(index, next.length), 0, previous)
        return next
      })
      toast.error(err.response?.data?.error || 'Не удалось удалить пользователя')
    }
    setPendingId(null)
  }

  const requestDelete = (user) => {
    setConfirm({
      title: 'Удалить пользователя?',
      message: `«${user.username}» (${user.email}) будет удалён без возможности восстановления.`,
      confirmLabel: 'Удалить',
      variant: 'danger',
      action: () => deleteUser(user.id),
    })
  }

  const runConfirm = async () => {
    if (!confirm) return
    const action = confirm.action
    setConfirm(null)
    await action()
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
              <Button
                size="sm"
                variant="danger"
                disabled={pendingId === u.id}
                onClick={() => requestDelete(u)}
              >
                Удалить
              </Button>
            </Card>
          ))}
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
