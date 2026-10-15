import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ToastContext = createContext(null)

const TYPES = {
  success: 'border-emerald-500 text-emerald-600 dark:text-emerald-400',
  error: 'border-red-500 text-red-600 dark:text-red-400',
  info: 'border-primary text-foreground dark:border-accent dark:text-foreground-dark',
}

const DEFAULT_DURATION_MS = 4000

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (message, type = 'info') => {
      if (!message) return null
      const id = (idRef.current += 1)
      setToasts((prev) => [...prev, { id, message, type }])
      window.setTimeout(() => dismiss(id), DEFAULT_DURATION_MS)
      return id
    },
    [dismiss],
  )

  const value = useMemo(
    () => ({
      toast: push,
      success: (message) => push(message, 'success'),
      error: (message) => push(message, 'error'),
      info: (message) => push(message, 'info'),
      dismiss,
    }),
    [push, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed left-1/2 top-20 z-50 flex w-[min(92vw,28rem)] -translate-x-1/2 flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto rounded-lg border-l-4 bg-card px-4 py-2 text-sm font-medium shadow-lg ring-1 ring-border-soft dark:bg-card-dark dark:ring-border-dark ${
              TYPES[t.type] || TYPES.info
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
