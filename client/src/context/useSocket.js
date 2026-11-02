import { createContext, useContext } from 'react'

/**
 * Контекст realtime (лаба 7). Провайдер — `SocketProvider` в `SocketContext.jsx`.
 *
 * - `connected` / `status` — состояние соединения;
 * - `presence` — { connections, users, usersCount, guests } (онлайн);
 * - `subscribe(event, handler)` — подписка с автоотпиской, возвращает unsubscribe.
 */
export const SocketContext = createContext(null)

export function useSocket() {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error('useSocket must be used within SocketProvider')
  return ctx
}
