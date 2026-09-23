import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../api'
import NewsCard from './NewsCard'
import Card from '../../components/ui/Card'
import Spinner from '../../components/ui/Spinner'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'

const PAGE_SIZE = 12

function driverLabel(driver) {
  return `${driver.lastName} (${driver.abbreviation})`
}

export default function NewsList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [drivers, setDrivers] = useState([])
  const [teams, setTeams] = useState([])
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const source = searchParams.get('source') || ''
  const lang = searchParams.get('lang') || ''
  const driverId = searchParams.get('driverId') || ''
  const teamId = searchParams.get('teamId') || ''

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([api.get('/drivers'), api.get('/teams')]).then(([d, t]) => {
      if (cancelled) return
      if (d.status === 'fulfilled') setDrivers(d.value.data.data || [])
      if (t.status === 'fulfilled') setTeams(t.value.data.data || [])
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setIsError(false)
      try {
        const { data: response } = await api.get('/news', {
          params: {
            page,
            limit: PAGE_SIZE,
            source: source || undefined,
            lang: lang || undefined,
            driverId: driverId || undefined,
            teamId: teamId || undefined,
          },
        })
        if (!cancelled) setData(response.data)
      } catch {
        if (!cancelled) setIsError(true)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [page, source, lang, driverId, teamId, reloadKey])

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setSearchParams(next)
  }

  const resetFilters = () => setSearchParams(new URLSearchParams())

  const hasFilters = Boolean(source || lang || driverId || teamId)

  if (isError) {
    return (
      <Card className="p-8 text-center">
        <p className="mb-4 text-sm font-medium text-red-500">Не удалось загрузить новости</p>
        <Button onClick={() => setReloadKey((k) => k + 1)}>Повторить</Button>
      </Card>
    )
  }

  const items = data?.items || []
  const totalPages = data?.totalPages || 0
  const showEmpty = !isLoading && data && (data.offline || items.length === 0)

  return (
    <div className="space-y-5">
      <Card className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          label="Пилот"
          value={driverId}
          onChange={(e) => updateParam('driverId', e.target.value)}
        >
          <option value="">Все пилоты</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>{driverLabel(d)}</option>
          ))}
        </Select>

        <Select
          label="Команда"
          value={teamId}
          onChange={(e) => updateParam('teamId', e.target.value)}
        >
          <option value="">Все команды</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </Select>

        <Select
          label="Источник"
          value={source}
          onChange={(e) => updateParam('source', e.target.value)}
        >
          <option value="">Все источники</option>
          {(data?.sources || []).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>

        <Select
          label="Язык"
          value={lang}
          onChange={(e) => updateParam('lang', e.target.value)}
        >
          <option value="">Все языки</option>
          <option value="ru">Русский</option>
          <option value="en">English</option>
        </Select>

        {hasFilters && (
          <div className="sm:col-span-2 lg:col-span-4">
            <Button size="xs" variant="ghost" onClick={resetFilters}>Сбросить фильтры</Button>
          </div>
        )}
      </Card>

      {data?.stale && (
        <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-400">
          Источники недоступны — показана сохранённая копия новостей.
        </div>
      )}

      {isLoading ? (
        <Spinner label="Загрузка новостей…" />
      ) : showEmpty ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium text-muted dark:text-muted-dark">
            {data?.offline
              ? 'Новостные ленты временно недоступны. Попробуйте позже.'
              : 'Ничего не найдено по выбранным фильтрам.'}
          </p>
        </Card>
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <NewsCard key={item.id || item.link} item={item} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => updateParam('page', String(page - 1))}
              >
                ← Назад
              </Button>
              <span className="text-sm text-muted dark:text-muted-dark">
                Стр. {page} из {totalPages} · всего {data.total}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={!data?.hasMore}
                onClick={() => updateParam('page', String(page + 1))}
              >
                Вперёд →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
