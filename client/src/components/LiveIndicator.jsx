import { useSocket } from '../context/useSocket'

/**
 * Индикатор realtime-соединения и онлайна (лаба 7).
 * Показывает статус подключения и число пользователей (уникальных) + гостей.
 */
export default function LiveIndicator() {
  const { status, statusLabel, presence } = useSocket()

  const dotClass =
    status === 'connected'
      ? 'bg-emerald-500'
      : status === 'connecting' || status === 'reconnecting'
        ? 'bg-amber-400 animate-pulse'
        : 'bg-red-500'

  const total = (presence?.usersCount || 0) + (presence?.guests || 0)

  return (
    <div
      className="flex items-center gap-2 rounded-full border border-border-soft px-3 py-1.5 text-xs dark:border-border-dark"
      title={`Live: ${statusLabel}. Соединений: ${presence?.connections ?? 0}`}
    >
      <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden />
      <span className="hidden font-semibold text-muted dark:text-muted-dark sm:inline">{statusLabel}</span>
      <span className="font-mono font-bold text-foreground dark:text-foreground-dark">{total}</span>
      <span className="text-muted dark:text-muted-dark">online</span>
    </div>
  )
}
