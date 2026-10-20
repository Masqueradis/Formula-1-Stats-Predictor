import useDocumentTitle from '../hooks/useDocumentTitle'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Badge from '../components/ui/Badge'
import VoteBoard from '../features/vote/VoteBoard'
import VotersSummary from '../features/vote/VotersSummary'
import CommentsList from '../features/vote/CommentsList'

export default function VotePage() {
  useDocumentTitle('Народный прогноз')
  const { user } = useAuth()
  const [doc, setDoc] = useState(null)
  const [stats, setStats] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('') // { status, message }

  const loadStats = useCallback(async (raceId) => {
    try {
      const { data } = await api.get(`/predictions/stats?raceId=${encodeURIComponent(raceId)}`)
      setStats(data.data)
    } catch {
      setStats([])
    }
  }, [])

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const { data } = await api.get('/predictions/next')
      setDoc(data.data)
      await loadStats(data.data.raceId)
    } catch (err) {
      const status = err.response?.status
      if (status === 404) setError('no-race')
      else if (status === 503) setError('mongo-down')
      else setError(err.response?.data?.error || 'Не удалось загрузить прогнозы')
      setDoc(null)
    }
    setIsLoading(false)
  }, [loadStats])

  useEffect(() => {
    load()
  }, [load])

  const handleDocChanged = (updatedDoc) => {
    setDoc(updatedDoc)
    loadStats(updatedDoc.raceId)
  }

  // Комментарии (в т.ч. лайки) не влияют на рейтинг — только обновляем документ,
  // без refetch stats (иначе таблица перерисовывалась бы при каждом лайке)
  const handleCommentsChanged = (updatedDoc) => {
    setDoc(updatedDoc)
  }

  if (isLoading) return <Spinner label="Загрузка голосования…" />

  if (error === 'no-race') {
    return (
      <Card className="p-8 text-center">
        <h1 className="mb-2 text-xl font-bold text-foreground dark:text-foreground-dark">Нет предстоящих гонок</h1>
        <p className="text-sm text-muted dark:text-muted-dark">
          Календарь пуст или сезон завершён — голосовать пока не на что.{' '}
          <Link to="/calendar" className="font-semibold text-primary underline dark:text-accent">Календарь</Link>
        </p>
      </Card>
    )
  }

  if (error === 'mongo-down') {
    return (
      <Card className="p-8 text-center">
        <h1 className="mb-2 text-xl font-bold text-foreground dark:text-foreground-dark">Прогнозы временно недоступны</h1>
        <p className="text-sm text-muted dark:text-muted-dark">
          MongoDB отключена — попробуйте обновить страницу позже.
        </p>
        <button
          type="button"
          onClick={load}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white dark:bg-accent"
        >
          Повторить
        </button>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-red-500">{error}</p>
        <button
          type="button"
          onClick={load}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white dark:bg-accent"
        >
          Повторить
        </button>
      </Card>
    )
  }

  if (!doc) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground dark:text-foreground-dark">Народный прогноз</h1>
        <Badge color={doc.votingOpen ? '#10b981' : '#64748b'}>
          {doc.votingOpen ? 'Голосование открыто' : 'Голосование закрыто'}
        </Badge>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 className="text-lg font-bold text-foreground dark:text-foreground-dark">{doc.raceName}</h2>
          <span className="text-sm text-muted dark:text-muted-dark">{doc.circuit}</span>
          <span className="text-sm text-muted dark:text-muted-dark">
            {doc.date && new Date(`${doc.date}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          <span className="text-sm text-muted dark:text-muted-dark">
            Сезон {doc.season}, этап {doc.round}
          </span>
        </div>
        <p className="mt-2 text-sm text-muted dark:text-muted-dark">
          Расставьте ожидаемые финишные места всем {doc.entries.length} пилотам следующего Гран-при до старта уик-энда.
          Общая картина всех голосов — «Народный рейтинг» ниже. Это общая фича сообщества; ваш личный прогноз
          кабинета и расчёт алгоритма — отдельные функции.
        </p>
      </Card>

      <VoteBoard doc={doc} user={user} onChanged={handleDocChanged} />

      <VotersSummary doc={doc} user={user} stats={stats} onChanged={handleDocChanged} />

      <CommentsList doc={doc} user={user} onChanged={handleCommentsChanged} />
    </div>
  )
}
