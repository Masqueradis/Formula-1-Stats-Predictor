import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSocket, refreshSocketAuth } from '../socket'
import { useAuth } from './useAuth'
import { SocketContext } from './useSocket'

/**
 * SocketContext (лаба 7): единая точка доступа к realtime.
 *
 * Соединение живёт в синглтоне (`src/socket.js`), поэтому StrictMode/HMR не создают дублей.
 * Сам контекст и хук `useSocket` — в `useSocket.js`.
 */

const STATUS_LABELS = {
  connected: 'подключено',
  connecting: 'подключение…',
  disconnected: 'нет связи',
  reconnecting: 'переподключение…',
}

export function SocketProvider({ children }) {
  const { isInitializing, user } = useAuth()
  const [status, setStatus] = useState('connecting')
  const [presence, setPresence] = useState({ connections: 0, users: [], usersCount: 0, guests: 0 })
  // Отложенный коннект: ждём bootstrap AuthContext, чтобы handshake ушёл уже с токеном.
  // isInitializing меняется один раз (false), поэтому ready выводится напрямую — без state и эффекта
  const ready = !isInitializing
  const prevUserRef = useRef(undefined)

  // Пересоздание handshake при смене пользователя (login/logout/401-refresh)
  useEffect(() => {
    if (!ready) return
    const prev = prevUserRef.current
    prevUserRef.current = user
    // Первый запуск после bootstrap — соединение создаётся ниже, ничего не пересоздаём
    if (prev === undefined) return
    const prevId = prev?.id ?? null
    const nextId = user?.id ?? null
    if (prevId !== nextId) refreshSocketAuth()
  }, [ready, user])

  useEffect(() => {
    if (!ready) return undefined

    const socket = getSocket()

    const onConnect = () => setStatus('connected')
    const onDisconnect = () => setStatus('disconnected')
    const onReconnecting = () => setStatus('reconnecting')
    const onPresence = (payload) => setPresence(payload || {})

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.io.on('reconnect_attempt', onReconnecting)
    socket.on('presence:update', onPresence)

    // Если сокет уже подключён (строгий режим/HMR) — синхронизируем статус
    if (socket.connected) setStatus('connected')
    else setStatus('connecting')

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.io.off('reconnect_attempt', onReconnecting)
      socket.off('presence:update', onPresence)
    }
  }, [ready])

  const subscribe = useCallback(
    (event, handler) => {
      const socket = getSocket()
      socket.on(event, handler)
      return () => socket.off(event, handler)
    },
    [],
  )

  /** Вход в комнату гонки (лаба 7). Возвращает функцию выхода. */
  const joinRace = useCallback((raceId) => {
    if (raceId == null) return () => {}
    const socket = getSocket()
    socket.emit('race:join', { raceId: String(raceId) })
    return () => socket.emit('race:leave', { raceId: String(raceId) })
  }, [])

  const value = useMemo(
    () => ({
      connected: status === 'connected',
      status,
      statusLabel: STATUS_LABELS[status] || status,
      presence,
      subscribe,
      joinRace,
      socketUrl: getSocket().io?.uri || null,
    }),
    [status, presence, subscribe, joinRace],
  )

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}

