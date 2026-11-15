import axios from 'axios'

const TOKEN_KEY = 'token'

const api = axios.create({
  // Относительный путь: /api проксирует vite dev-сервер (dev-контейнер)
  // и nginx (prod-контейнер) → одинаковый адрес везде, CORS не нужен
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Неверный пароль на форме входа — не повод перезагружать страницу:
// иначе теряется введённое и ошибка не успевает показаться (BUG-03).
const AUTH_ENTRYPOINTS = ['/auth/login', '/auth/register']

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = String(error.config?.url || '')
      const isAuthEntrypoint = AUTH_ENTRYPOINTS.some((path) => url.includes(path))
      if (!isAuthEntrypoint) {
        localStorage.removeItem(TOKEN_KEY)
        if (window.location.pathname !== '/login') {
          window.location.assign('/login')
        }
      }
    }
    return Promise.reject(error)
  },
)

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export default api