import { createContext, useContext } from 'react'

/** Контекст глобальных тостов. Провайдер — `ToastProvider` в `Toast.jsx`. */
export const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
