export default function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Переключить тему"
      className="inline-flex items-center gap-1.5 rounded-lg border border-border-soft bg-card px-2 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-primary hover:text-white dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark dark:hover:bg-accent sm:gap-2 sm:px-3"
    >
      <span aria-hidden>{isDark ? '☀️' : '🌙'}</span>
      <span className="hidden sm:inline">{isDark ? 'Светлая' : 'Тёмная'}</span>
    </button>
  )
}
