import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const PUBLIC_ITEMS = [
  { to: '/', label: 'Главная', end: true },
  { to: '/drivers', label: 'Пилоты' },
  { to: '/teams', label: 'Команды' },
  { to: '/calendar', label: 'Календарь' },
  { to: '/standings', label: 'Турнирная таблица' },
  { to: '/predictions', label: 'Прогнозы' },
]

export default function NavBar() {
  const { user } = useAuth()

  const items = [
    ...PUBLIC_ITEMS,
    ...(user ? [{ to: '/cabinet', label: 'Кабинет' }] : []),
    ...(user?.role === 'ADMIN' ? [{ to: '/admin', label: 'Админ' }] : []),
  ]

  return (
    <nav className="flex flex-wrap items-center gap-1">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-primary text-white dark:bg-accent'
                : 'text-muted hover:bg-background hover:text-foreground dark:text-muted-dark dark:hover:bg-background-dark dark:hover:text-foreground-dark'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}