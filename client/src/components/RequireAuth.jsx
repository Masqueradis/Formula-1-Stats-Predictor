import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from './ui/Spinner'

export function RequireAuth() {
  const { user, isInitializing } = useAuth()
  const location = useLocation()

  if (isInitializing) return <Spinner label="Проверяем авторизацию…" />

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return <Outlet />
}

export function RequireAdmin() {
  const { user, isInitializing } = useAuth()

  if (isInitializing) return <Spinner label="Проверяем авторизацию…" />

  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'ADMIN') return <Navigate to="/" replace />

  return <Outlet />
}

export function RequireGuest() {
  const { user, isInitializing } = useAuth()
  const location = useLocation()

  if (isInitializing) return <Spinner label="Проверяем авторизацию…" />

  if (user) return <Navigate to={location.state?.from || '/'} replace />

  return <Outlet />
}