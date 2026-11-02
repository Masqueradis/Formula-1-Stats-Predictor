import { useCallback, useEffect, useState } from 'react'
import api, { getToken, setToken } from '../api'
import { AuthContext } from './useAuth'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      if (!getToken()) {
        setIsInitializing(false)
        return
      }
      try {
        const { data } = await api.get('/auth/me')
        if (!cancelled) setUser(data.data)
      } catch {
        if (!cancelled) {
          setToken(null)
          setUser(null)
        }
      } finally {
        if (!cancelled) setIsInitializing(false)
      }
    }

    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    setToken(data.data.token)
    setUser(data.data.user)
    return data.data.user
  }, [])

  const register = useCallback(async (username, email, password) => {
    const { data } = await api.post('/auth/register', { username, email, password })
    return data.data
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  const refreshMe = useCallback(async () => {
    const { data } = await api.get('/auth/me')
    setUser(data.data)
    return data.data
  }, [])

  return (
    <AuthContext.Provider value={{ user, isInitializing, login, register, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  )
}
