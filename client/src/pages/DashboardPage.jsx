import useDocumentTitle from '../hooks/useDocumentTitle'
import NewsList from '../features/news/NewsList'

export default function DashboardPage() {
  useDocumentTitle('Главная')
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground dark:text-foreground-dark">Новости Формулы-1</h1>
          <p className="mt-1 text-sm text-muted dark:text-muted-dark">
            Лента из английских и русских источников (BBC Sport, F1i, ESPN, Google News) с фильтрами по
            пилотам, командам и источнику
          </p>
        </div>
      </div>
      <NewsList />
    </div>
  )
}