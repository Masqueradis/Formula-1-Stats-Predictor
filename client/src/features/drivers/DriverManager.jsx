import { useEffect, useMemo, useState } from 'react'
import { mockDrivers } from './driversData'
import AddDriverForm from './AddDriverForm'
import DriverCard from './DriverCard'
import SearchFilter from './SearchFilter'
import Card from '../../components/ui/Card'
import Spinner from '../../components/ui/Spinner'

const STORAGE_KEY = 'f1-drivers'

export default function DriverManager() {
  const [drivers, setDrivers] = useState(mockDrivers)
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)

  const [search, setSearch] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [sortField, setSortField] = useState('lastName')
  const [sortOrder, setSortOrder] = useState('asc')

  // Эффект монтирования: имитация загрузки с "сервера" (1с) + чтение из localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setDrivers(parsed)
          }
        } catch {
          /* повреждённые данные — оставляем моковые */
        }
      }
      setIsLoading(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  // Сохранение списка в localStorage при каждом изменении (с debounce 500мс)
  useEffect(() => {
    if (isLoading) return
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(drivers))
    }, 500)
    return () => clearTimeout(timer)
  }, [drivers, isLoading])

  // Побочный эффект: заголовок документа зависит от количества пилотов
  useEffect(() => {
    document.title = `F1 Drivers — ${drivers.length} ${plural(drivers.length)}`
  }, [drivers])

  const addDriver = (driver) => {
    if (drivers.some((d) => d.abbreviation === driver.abbreviation)) {
      return false
    }
    setDrivers((prev) => [...prev, driver])
    return true
  }

  const updateDriver = (id, patch) => {
    setDrivers((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch, podiums: Number(patch.podiums) || 0 } : d)))
    setEditingId(null)
  }

  const deleteDriver = (id) => {
    setDrivers((prev) => prev.filter((d) => d.id !== id))
    if (editingId === id) setEditingId(null)
  }

  const visibleDrivers = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = drivers.filter((d) => {
      const matchesSearch =
        !q ||
        `${d.firstName} ${d.lastName}`.toLowerCase().includes(q) ||
        d.abbreviation.toLowerCase().includes(q) ||
        d.team.toLowerCase().includes(q)
      const matchesTeam = !teamFilter || d.team === teamFilter
      return matchesSearch && matchesTeam
    })

    const dir = sortOrder === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = a[sortField]
      const bv = b[sortField]
      if (typeof av === 'string') return av.localeCompare(bv) * dir
      return (av - bv) * dir
    })
  }, [drivers, search, teamFilter, sortField, sortOrder])

  if (isLoading) {
    return <Spinner label="Загрузка пилотов…" />
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
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section>
          <h2 className="mb-4 text-lg font-bold text-foreground dark:text-foreground-dark">
            Пилоты <span className="font-mono text-sm text-muted dark:text-muted-dark">({visibleDrivers.length})</span>
          </h2>
          {visibleDrivers.length === 0 ? (
            <Card className="border-dashed p-8 text-center text-muted dark:text-muted-dark">
              Ничего не найдено. Измените фильтры или добавьте пилота.
            </Card>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {visibleDrivers.map((d) => (
                <DriverCard
                  key={d.id}
                  driver={d}
                  isEditing={editingId === d.id}
                  onStartEdit={() => setEditingId(d.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onSaveEdit={updateDriver}
                  onDelete={deleteDriver}
                />
              ))}
            </div>
          )}
        </section>

        <aside>
          <AddDriverForm onAdd={addDriver} />
        </aside>
      </div>
    </div>
  )
}

function plural(n) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'пилот'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'пилота'
  return 'пилотов'
}
