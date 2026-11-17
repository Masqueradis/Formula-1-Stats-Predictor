import { io } from 'socket.io-client'
import { getToken } from './api'
import { resolveSocketBaseUrl } from './utils/socketUrl'

const API_URL = import.meta.env.VITE_API_URL || '/api'
export const SOCKET_URL = resolveSocketBaseUrl(API_URL, import.meta.env.VITE_SOCKET_URL)

let socket = null

export function getSocket() {
  if (socket) return socket

  socket = io(SOCKET_URL || undefined, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    auth: { token: getToken() || undefined },
  })

  return socket
}

export function refreshSocketAuth() {
  if (!socket) return null
  socket.auth = { token: getToken() || undefined }
  socket.disconnect()
  socket.connect()
  return socket
}

export default getSocket
