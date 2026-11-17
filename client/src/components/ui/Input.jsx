const TEXT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel'])

export default function Input({ label, type = 'text', className = '', maxLength, ...props }) {
  const effectiveMaxLength = maxLength ?? (TEXT_TYPES.has(type) ? 120 : undefined)

  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted dark:text-muted-dark">
      {label}
      <input
        type={type}
        maxLength={effectiveMaxLength}
        className={`w-full rounded-md border border-border-soft bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary dark:border-border-dark dark:bg-background-dark dark:text-foreground-dark dark:focus:border-accent ${className}`}
        {...props}
      />
    </label>
  )
}
