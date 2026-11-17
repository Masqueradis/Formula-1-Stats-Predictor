import { useState } from 'react'

export default function Disclosure({
  title,
  subtitle,
  badge = null,
  defaultOpen = true,
  children,
  className = '',
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-border-soft bg-card px-5 py-3.5 text-left shadow-sm transition-colors hover:border-primary/50 dark:border-border-dark dark:bg-card-dark dark:hover:border-accent/50"
      >
        <span className="flex min-w-0 flex-wrap items-baseline gap-2">
          <span className="text-lg font-bold text-foreground dark:text-foreground-dark">{title}</span>
          {badge}
          {subtitle && (
            <span className="text-sm font-normal text-muted dark:text-muted-dark">{subtitle}</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted dark:text-muted-dark">
          {open ? 'Свернуть' : 'Развернуть'}
          <svg
            viewBox="0 0 24 24"
            className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open && <div className="mt-3 space-y-3">{children}</div>}
    </div>
  )
}
