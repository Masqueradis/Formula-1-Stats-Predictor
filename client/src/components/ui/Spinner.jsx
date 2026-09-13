export default function Spinner({ label = 'Загрузка…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted dark:text-muted-dark">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-border-soft border-t-primary dark:border-border-dark dark:border-t-accent" />
      <p>{label}</p>
    </div>
  )
}
