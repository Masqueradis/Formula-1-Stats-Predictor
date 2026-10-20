import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api'
import { getSocket } from '../../socket'
import { useSocket } from '../../context/SocketContext'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useToast } from '../../components/ui/Toast'

export default function CommentsList({ doc, user, onChanged }) {
  const toast = useToast()
  const { subscribe, connected } = useSocket()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [likingId, setLikingId] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [typingUsers, setTypingUsers] = useState([]) // [{ username, at }]
  const lastTypingRef = useRef(0)

  const comments = [...(doc.comments || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  // Индикатор «печатает…»: приём с автоочисткой и троттлинг своей отправки
  useEffect(() => {
    if (!connected) return undefined
    return subscribe('comment:typing', (payload) => {
      if (String(payload?.raceId) !== String(doc.raceId)) return
      if (user && Number(payload.userId) === Number(user.id)) return // свой ввод не показываем
      const name = payload.username || 'Кто-то'
      setTypingUsers((prev) => {
        const others = prev.filter((t) => t.username !== name)
        return [...others, { username: name, at: Date.now() }]
      })
    })
  }, [subscribe, connected, doc.raceId, user])

  // Автоочистка индикатора через 3 c без новых событий
  useEffect(() => {
    if (typingUsers.length === 0) return undefined
    const timer = window.setInterval(() => {
      const now = Date.now()
      setTypingUsers((prev) => prev.filter((t) => now - t.at < 3000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [typingUsers.length])

  const emitTyping = (value) => {
    if (!connected || !value) return
    const now = Date.now()
    if (now - lastTypingRef.current < 1500) return // троттлинг ≤1 события в 1.5 c
    lastTypingRef.current = now
    getSocket().emit('comment:typing', { raceId: String(doc.raceId) })
  }

  const addComment = async (e) => {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    setBusy(true)
    try {
      const { data } = await api.post(`/predictions/race/${doc.raceId}/comments`, { text: value })
      setText('')
      onChanged(data.data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Не удалось отправить комментарий')
    }
    setBusy(false)
  }

  const toggleLike = async (commentId) => {
    if (!user || likingId) return // защита от двойного клика/параллельных запросов
    setLikingId(commentId)
    try {
      const { data } = await api.put(`/predictions/race/${doc.raceId}/comments/${commentId}/like`)
      onChanged(data.data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Не удалось обновить лайк')
    }
    setLikingId(null)
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setBusy(true)
    try {
      const { data } = await api.delete(`/predictions/race/${doc.raceId}/comments/${pendingDelete}`)
      toast.success('Комментарий удалён')
      onChanged(data.data)
      setPendingDelete(null)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Не удалось удалить комментарий')
    }
    setBusy(false)
  }

  const canDelete = (c) => user && (Number(c.userId) === Number(user.id) || user.role === 'ADMIN')

  return (
    <Card className="p-6">
      <h2 className="mb-3 text-lg font-bold text-foreground dark:text-foreground-dark">
        Комментарии{' '}
        <span className="text-sm font-normal text-muted dark:text-muted-dark">({comments.length})</span>
      </h2>

      {user ? (
        <form onSubmit={addComment} className="mb-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={text}
            onChange={(e) => { setText(e.target.value); emitTyping(e.target.value) }}
            maxLength={2000}
            placeholder="Обсудите народный прогноз этой гонки…"
            className="flex-1 rounded-lg border border-border-soft bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary dark:border-border-dark dark:bg-background-dark dark:text-foreground-dark dark:focus:border-accent"
          />
          <Button type="submit" disabled={busy || !text.trim()}>
            {busy ? 'Отправка…' : 'Отправить'}
          </Button>
        </form>
      ) : (
        <p className="mb-4 text-sm text-muted dark:text-muted-dark">
          Комментарии доступны вошедшим пользователям.{' '}
          <Link to="/login" className="font-semibold text-primary underline dark:text-accent">
            Войти
          </Link>
        </p>
      )}

      {typingUsers.length > 0 && connected && (
        <p className="mb-3 flex items-center gap-1.5 text-xs italic text-muted dark:text-muted-dark">
          <span className="inline-flex gap-0.5">
            <span className="h-1 w-1 animate-bounce rounded-full bg-primary dark:bg-accent" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:150ms] dark:bg-accent" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:300ms] dark:bg-accent" />
          </span>
          {typingUsers.map((t) => t.username).join(', ')} {typingUsers.length === 1 ? 'печатает' : 'печатают'}…
        </p>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-muted dark:text-muted-dark">Комментариев пока нет — напишите первый.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => (
            <li key={c._id} className="rounded-lg border border-border-soft px-3 py-2 dark:border-border-dark">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-foreground dark:text-foreground-dark">{c.username}</span>
                <span className="text-muted dark:text-muted-dark">
                  {new Date(c.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleLike(c._id)}
                    disabled={!user || likingId === c._id}
                    title={user ? 'Поставить/снять лайк' : 'Войдите, чтобы лайкнуть'}
                    className={`rounded-md px-2 py-0.5 text-xs font-semibold transition-colors ${
                      user && (c.likes || []).some((id) => Number(id) === Number(user.id))
                        ? 'bg-red-500 text-white'
                        : 'text-muted hover:bg-background dark:text-muted-dark dark:hover:bg-background-dark'
                    }`}
                  >
                    ♥ {Array.isArray(c.likes) ? c.likes.length : 0}
                  </button>
                  {canDelete(c) && (
                    <Button variant="ghost" size="xs" onClick={() => setPendingDelete(c._id)} disabled={busy}>
                      Удалить
                    </Button>
                  )}
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-foreground dark:text-foreground-dark">{c.text}</p>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Удалить комментарий?"
        message="Комментарий будет удалён безвозвратно."
        confirmLabel="Удалить"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </Card>
  )
}
