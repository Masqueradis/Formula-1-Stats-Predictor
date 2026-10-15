import { useEffect } from 'react'
import Button from './Button'

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  variant = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined

    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel?.()
    }
    document.addEventListener('keydown', handleKey)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!busy) onCancel?.()
        }}
      />
      <div className="relative w-full max-w-md rounded-xl border border-border-soft bg-card p-5 shadow-xl dark:border-border-dark dark:bg-card-dark">
        <h2 className="text-lg font-bold text-foreground dark:text-foreground-dark">{title}</h2>
        {message && <p className="mt-2 text-sm text-muted dark:text-muted-dark">{message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} disabled={busy} autoFocus>
            {busy ? 'Подождите…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
