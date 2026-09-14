const VARIANTS = {
  primary:
    'bg-primary text-white hover:bg-primary-hover dark:bg-accent dark:hover:bg-accent-hover',
  outline:
    'border border-border-soft text-foreground hover:bg-primary hover:text-white dark:border-border-dark dark:text-foreground-dark dark:hover:bg-accent',
  danger:
    'border border-red-500 text-red-500 hover:bg-red-500 hover:text-white',
  ghost:
    'text-muted hover:bg-background dark:text-muted-dark dark:hover:bg-background-dark',
}

const SIZES = {
  xs: 'px-2 py-1.5 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

export default function Button({ variant = 'primary', size = 'md', className = '', children, ...props }) {
  return (
    <button
      type="button"
      className={`rounded-lg font-semibold transition-colors ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
