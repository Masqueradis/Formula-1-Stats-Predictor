import { NavLink, Outlet } from 'react-router-dom'
import Card from '../../components/ui/Card'

const TABS = [
  { to: '/admin/drivers', label: 'Пилоты' },
  { to: '/admin/users', label: 'Пользователи' },
  { to: '/admin/sync', label: 'Данные' },
]

export default function AdminLayout() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground dark:text-foreground-dark">Админ-панель</h1>

      <Card className="px-4 py-2">
        <nav className="flex gap-1">
          {TABS.map(tab => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-primary text-white dark:bg-accent'
                    : 'text-muted hover:text-foreground dark:text-muted-dark dark:hover:text-foreground-dark'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </Card>

      <Outlet />
    </div>
  )
}