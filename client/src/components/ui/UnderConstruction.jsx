import Card from './Card'

export default function UnderConstruction({ title = 'Раздел в разработке' }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-4 border-dashed p-16 text-center">
      <span className="text-4xl" aria-hidden>🚧</span>
      <h2 className="text-xl font-bold text-foreground dark:text-foreground-dark">{title}</h2>
      <p className="max-w-md text-sm text-muted dark:text-muted-dark">
        Этот раздел будет реализован в следующих лабораторных работах и подключён к бэкенду.
      </p>
    </Card>
  )
}
