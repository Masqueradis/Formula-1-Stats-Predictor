import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ username: '', email: '', password: '' })
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
      await register(form.username, form.email, form.password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
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
            <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm font-medium text-red-500">{error}</p>
          )}

          <Button className="w-full" disabled={loading}>
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