import useDocumentTitle from '../hooks/useDocumentTitle'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import errorMessage from '../utils/errorMessages'

export default function RegisterPage() {
  useDocumentTitle('Регистрация')
  const { register, resendVerification } = useAuth()

  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [resendStatus, setResendStatus] = useState('')
  const [resending, setResending] = useState(false)

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(form.username, form.email, form.password)
      setRegisteredEmail(form.email)
    } catch (err) {
      setError(errorMessage(err, 'Не удалось зарегистрироваться. Попробуйте ещё раз.'))
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setError('')
    setResendStatus('')
    setResending(true)
    try {
      const result = await resendVerification(registeredEmail)
      setResendStatus(result?.message || 'Письмо отправлено повторно, если аккаунт ожидает подтверждения.')
    } catch (err) {
      setError(errorMessage(err, 'Не удалось отправить письмо повторно.'))
    } finally {
      setResending(false)
    }
  }

  if (registeredEmail) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 text-2xl dark:bg-accent/20">
            ✉️
          </div>
          <h1 className="mb-2 text-xl font-bold text-foreground dark:text-foreground-dark">Проверьте почту</h1>
          <p className="mb-4 text-sm text-muted dark:text-muted-dark">
            Мы отправили письмо на <strong className="text-foreground dark:text-foreground-dark">{registeredEmail}</strong>.
            Подтвердите email по ссылке из письма, чтобы войти в аккаунт. Ссылка действительна 24 часа.
          </p>
          {import.meta.env.DEV && (
            <p className="mb-4 text-xs text-muted dark:text-muted-dark">
              В режиме разработки письма попадают в Mailhog:{' '}
              <a href="http://localhost:8025" target="_blank" rel="noreferrer" className="font-semibold text-primary underline dark:text-accent">
                localhost:8025
              </a>
            </p>
          )}
          {resendStatus && (
            <p role="status" className="mb-3 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
              {resendStatus}
            </p>
          )}
          {error && (
            <p role="alert" className="mb-3 rounded-md bg-red-500/10 px-3 py-2 text-sm font-medium text-red-500">{error}</p>
          )}
          <div className="flex flex-col items-center gap-3">
            <Button variant="outline" onClick={handleResend} disabled={resending}>
              {resending ? 'Отправляем…' : 'Отправить письмо ещё раз'}
            </Button>
            <Link to="/login">
              <Button variant="ghost">Перейти ко входу</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md p-8">
        <h1 className="mb-1 text-xl font-bold text-foreground dark:text-foreground-dark">Регистрация</h1>
        <p className="mb-6 text-sm text-muted dark:text-muted-dark">
          Создайте аккаунт для участия в предсказаниях
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Имя пользователя" name="username" value={form.username} onChange={handleChange} autoFocus />
          <Input label="Email" name="email" type="email" value={form.email} onChange={handleChange} />
          <Input label="Пароль (мин. 6 символов)" name="password" type="password" value={form.password} onChange={handleChange} />

          {error && (
            <p role="alert" className="rounded-md bg-red-500/10 px-3 py-2 text-sm font-medium text-red-500">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Создание аккаунта…' : 'Зарегистрироваться'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted dark:text-muted-dark">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="font-semibold text-primary hover:underline dark:text-accent">
            Войдите
          </Link>
        </p>
      </Card>
    </div>
  )
}