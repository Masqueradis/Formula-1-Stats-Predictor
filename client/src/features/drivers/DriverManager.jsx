import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import api from '../../api'
import DriverCard from './DriverCard'
import SearchFilter from './SearchFilter'
import Card from '../../components/ui/Card'
import Spinner from '../../components/ui/Spinner'

const SEARCH_DEBOUNCE_MS = 400

export default function DriverManager() {
  const [drivers, setDrivers] = useState([])
  const [teams, setTeams] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [sortField, setSortField] = useState('lastName')
  const [sortOrder, setSortOrder] = useState('asc')

  const abortRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    timerRef.current = window.setTimeout(() => {
      setDebouncedSearch(search)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timerRef.current)
  }, [search])

  const loadDrivers = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setError('')
    try {
      const params = {}
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim()
      if (teamFilter) params.teamId = teamFilter

      const { data } = await api.get('/drivers', { params, signal: controller.signal })
      setDrivers(data.data || [])
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return
      setError('Не удалось загрузить пилотов')
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
    }
  }, [debouncedSearch, teamFilter])

  useEffect(() => {
    loadDrivers()
  }, [loadDrivers])

  useEffect(() => {
    api.get('/teams')
      .then(({ data }) => setTeams(data.data || []))
      .catch(() => {})
  }, [])

  const visibleDrivers = useMemo(() => {
    const dir = sortOrder === 'asc' ? 1 : -1
    return [...drivers].sort((a, b) => {
      const av = a[sortField]
      const bv = b[sortField]
      if (typeof av === 'string') return av.localeCompare(bv) * dir
      return (av - bv) * dir
    })
  }, [drivers, sortField, sortOrder])

  if (isLoading) return <Spinner label="Загрузка пилотов…" />

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="mb-4 text-sm font-medium text-red-500">{error}</p>
        <span className="sr-only">Ошибка загрузки</span>
        <button
          type="button"
          onClick={loadDrivers}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover dark:bg-accent dark:hover:bg-accent-hover"
        >
          Повторить
        </button>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <SearchFilter
        search={search}
        onSearch={setSearch}
        team={teamFilter}
        onTeam={setTeamFilter}
        sortField={sortField}
        onSortField={setSortField}
        sortOrder={sortOrder}
        onSortOrder={setSortOrder}
        teams={teams}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr]">
        <section>
          <h2 className="mb-4 text-lg font-bold text-foreground dark:text-foreground-dark">
            Пилоты{' '}
            <span className="font-mono text-sm text-muted dark:text-muted-dark">({visibleDrivers.length})</span>
          </h2>
          {visibleDrivers.length === 0 ? (
            <Card className="border-dashed p-8 text-center text-muted dark:text-muted-dark">
              Ничего не найдено. Измените фильтры.
            </Card>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visibleDrivers.map((d) => (
                <DriverCard key={d.id} driver={d} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}