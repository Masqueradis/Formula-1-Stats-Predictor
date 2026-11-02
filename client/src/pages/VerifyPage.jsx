import useDocumentTitle from '../hooks/useDocumentTitle'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../api'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'

export default function VerifyPage() {
  useDocumentTitle('Подтверждение почты')
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState(() => (token ? 'loading' : 'error'))
  const [message, setMessage] = useState(() =>
    token ? '' : 'Отсутствует токен подтверждения. Откройте ссылку из письма целиком.',
  )

  useEffect(() => {
    if (!token) return

    let cancelled = false
    api
      .get(`/auth/verify/${encodeURIComponent(token)}`)
      .then(() => {
        if (!cancelled) setStatus('success')
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus('error')
          setMessage(err.response?.data?.error || 'Не удалось подтвердить email')
        }
      })
    return () => { cancelled = true }
  }, [token])

  if (status === 'loading') return <Spinner label="Подтверждаем email…" />

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md p-8 text-center">
        {status === 'success' ? (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 text-2xl dark:bg-accent/20">
              ✓
            </div>
            <h1 className="mb-2 text-xl font-bold text-foreground dark:text-foreground-dark">Email подтверждён</h1>
            <p className="mb-4 text-sm text-muted dark:text-muted-dark">
              Ваш аккаунт активирован. Теперь вы можете войти.
            </p>
            <Link to="/login">
              <Button>Войти</Button>
            </Link>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 text-2xl">
              ✕
            </div>
            <h1 className="mb-2 text-xl font-bold text-foreground dark:text-foreground-dark">Ошибка подтверждения</h1>
            <p className="mb-4 text-sm text-muted dark:text-muted-dark">{message}</p>
            <Link to="/login">
              <Button variant="outline">На страницу входа</Button>
            </Link>
          </>
        )}
      </Card>
    </div>
  )
}