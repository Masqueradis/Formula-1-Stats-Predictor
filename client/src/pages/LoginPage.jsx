import useDocumentTitle from '../hooks/useDocumentTitle'
import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'

export default function LoginPage() {
  useDocumentTitle('Вход')
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/'

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка авторизации')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md p-8">
        <h1 className="mb-1 text-xl font-bold text-foreground dark:text-foreground-dark">Вход</h1>
        <p className="mb-6 text-sm text-muted dark:text-muted-dark">
          Войдите в аккаунт для доступа к кабинету
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Email" name="email" type="email" value={form.email} onChange={handleChange} autoFocus />
          <Input label="Пароль" name="password" type="password" value={form.password} onChange={handleChange} />

          {error && (
            <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm font-medium text-red-500">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Вход…' : 'Войти'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted dark:text-muted-dark">
          Нет аккаунта?{' '}
          <Link to="/register" className="font-semibold text-primary hover:underline dark:text-accent">
            Зарегистрируйтесь
          </Link>
        </p>
      </Card>
    </div>
  )
}