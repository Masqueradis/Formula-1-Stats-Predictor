import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../api'
import NewsCard from './NewsCard'
import Card from '../../components/ui/Card'
import Spinner from '../../components/ui/Spinner'
import Select from '../../components/ui/Select'
import Input from '../../components/ui/Input'
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
  // Архив в Postgres (эпик-09, P4): режим + полнотекстовый поиск/даты
  const mode = searchParams.get('mode') === 'archive' ? 'archive' : 'live'
  const q = searchParams.get('q') || ''
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const [archiveForm, setArchiveForm] = useState({ q, from, to })

  useEffect(() => {
    setArchiveForm({ q, from, to })
  }, [q, from, to])

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
        const response = mode === 'archive'
          ? await api.get('/news/archive', {
            params: {
              page,
              limit: PAGE_SIZE,
              q: q || undefined,
              from: from || undefined,
              to: to || undefined,
            },
          })
          : await api.get('/news', {
            params: {
              page,
              limit: PAGE_SIZE,
              source: source || undefined,
              lang: lang || undefined,
              driverId: driverId || undefined,
              teamId: teamId || undefined,
              from: from || undefined,
              to: to || undefined,
            },
          })
        if (!cancelled) setData(response.data.data)
      } catch {
        if (!cancelled) setIsError(true)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [mode, page, source, lang, driverId, teamId, q, from, to, reloadKey])

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setSearchParams(next)
  }

  const resetFilters = () => setSearchParams(new URLSearchParams())

  // Переключение «Лента ↔ Архив» (архив — поиск по сохранённым в Postgres новостям)
  const switchMode = (next) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'archive') params.set('mode', 'archive')
    else params.delete('mode')
    params.delete('page')
    setSearchParams(params)
  }

  const applyArchive = (event) => {
    event.preventDefault()
    const params = new URLSearchParams(searchParams)
    params.set('mode', 'archive')
    const term = archiveForm.q.trim()
    if (term) params.set('q', term)
    else params.delete('q')
    if (archiveForm.from) params.set('from', archiveForm.from)
    else params.delete('from')
    if (archiveForm.to) params.set('to', archiveForm.to)
    else params.delete('to')
    params.delete('page')
    setSearchParams(params)
  }

  const hasFilters = Boolean(source || lang || driverId || teamId || q || from || to)

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
      <Card className="space-y-3 p-4">
        <div className="flex gap-2">
          <Button
            size="xs"
            variant={mode === 'live' ? 'primary' : 'outline'}
            onClick={() => switchMode('live')}
          >
            Лента
          </Button>
          <Button
            size="xs"
            variant={mode === 'archive' ? 'primary' : 'outline'}
            onClick={() => switchMode('archive')}
          >
            Архив
          </Button>
        </div>

        {mode === 'live' ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

            <Input
              label="С даты"
              type="date"
              value={from}
              onChange={(e) => updateParam('from', e.target.value)}
            />

            <Input
              label="По дату"
              type="date"
              value={to}
              onChange={(e) => updateParam('to', e.target.value)}
            />
          </div>
        ) : (
          <form className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={applyArchive}>
            <Input
              label="Поиск по словам"
              value={archiveForm.q}
              placeholder="Например: Verstappen"
              onChange={(e) => setArchiveForm({ ...archiveForm, q: e.target.value })}
            />
            <Input
              label="С даты"
              type="date"
              value={archiveForm.from}
              onChange={(e) => setArchiveForm({ ...archiveForm, from: e.target.value })}
            />
            <Input
              label="По дату"
              type="date"
              value={archiveForm.to}
              onChange={(e) => setArchiveForm({ ...archiveForm, to: e.target.value })}
            />
            <Button type="submit" size="sm">Найти</Button>
          </form>
        )}

        {hasFilters && (
          <Button size="xs" variant="ghost" onClick={resetFilters}>Сбросить фильтры</Button>
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
