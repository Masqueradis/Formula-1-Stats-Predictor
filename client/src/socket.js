import { io } from 'socket.io-client'
import { getToken } from './api'

/**
 * Синглтон Socket.IO-соединения (лаба 7).
 *
 * Соединение создаётся лениво, вне React-эффекта — защита от двойного коннекта
 * в React StrictMode и дублей при HMR. Компоненты только подписываются на события.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
// База сокета — тот же origin, что и API, но без хвоста /api
export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || API_URL.replace(/\/api\/?$/, '')

let socket = null

export function getSocket() {
  if (socket) return socket

  socket = io(SOCKET_URL, {
    // Поднимаемся сразу по WebSocket; polling оставлен как фолбэк при блокировке WS
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    auth: { token: getToken() || undefined },
  })

  return socket
}

/** Переиспользовать тот же сокет с актуальным JWT (вызывается при login/logout). */
export function refreshSocketAuth() {
  if (!socket) return null
  socket.auth = { token: getToken() || undefined }
  // Пересоздаём handshake, чтобы сервер получил новую личность
  socket.disconnect()
  socket.connect()
  return socket
}

export default getSocket
