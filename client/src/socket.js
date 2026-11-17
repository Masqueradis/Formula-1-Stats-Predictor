import { io } from 'socket.io-client'
import { getToken } from './api'
import { resolveSocketBaseUrl } from './utils/socketUrl'

/**
 * Синглтон Socket.IO-соединения (лаба 7).
 *
 * Соединение создаётся лениво, вне React-эффекта — защита от двойного коннекта
 * в React StrictMode и дублей при HMR. Компоненты только подписываются на события.
 */

const API_URL = import.meta.env.VITE_API_URL || '/api'
// '' → io() подключится к window.location (vite dev / nginx).
// Полный прод-URL заканчивается на /api — суффикс снимается, иначе Socket.IO
// уйдёт в несуществующий namespace /api и presence не придёт никогда.
export const SOCKET_URL = resolveSocketBaseUrl(API_URL, import.meta.env.VITE_SOCKET_URL)

let socket = null

export function getSocket() {
  if (socket) return socket

  // '' → undefined: io() без URL подключится к window.location (та же страница)
  socket = io(SOCKET_URL || undefined, {
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
