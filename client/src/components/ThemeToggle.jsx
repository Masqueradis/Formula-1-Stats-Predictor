export default function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Переключить тему"
      className="inline-flex items-center gap-2 rounded-lg border border-border-soft bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-primary hover:text-white dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark dark:hover:bg-accent"
    >
      <span aria-hidden>{isDark ? '☀️' : '🌙'}</span>
      <span>{isDark ? 'Светлая' : 'Тёмная'}</span>
    </button>
  )
}
