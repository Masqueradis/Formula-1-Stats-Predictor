import Card from '../../components/ui/Card'

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function NewsCard({ item }) {
  const langLabel = item.lang === 'ru' ? 'RU' : 'EN'

  return (
    <Card className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lg">
      {item.image ? (
        <img
          src={item.image}
          alt={item.title}
          loading="lazy"
          className="h-36 w-full object-cover"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      ) : (
        <div className="flex h-36 w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 dark:from-zinc-800 dark:to-zinc-950">
          <span className="font-mono text-xl font-black italic tracking-widest text-white/25">
            F1 NEWS
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary dark:bg-accent/15 dark:text-accent">
            {item.source?.name || 'F1'}
          </span>
          <span className="rounded-full bg-border-soft px-2 py-0.5 text-[11px] font-semibold text-muted dark:bg-border-dark dark:text-muted-dark">
            {langLabel}
          </span>
        </div>

        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-3 font-bold leading-snug text-foreground transition-colors hover:text-primary dark:text-foreground-dark dark:hover:text-accent"
        >
          {item.title}
        </a>

        {item.description && (
          <p className="mt-2 line-clamp-2 text-sm text-muted dark:text-muted-dark">{item.description}</p>
        )}

        {item.publishedAt && (
          <p className="mt-auto pt-3 text-xs text-muted dark:text-muted-dark">{formatDate(item.publishedAt)}</p>
        )}
      </div>
    </Card>
  )
}