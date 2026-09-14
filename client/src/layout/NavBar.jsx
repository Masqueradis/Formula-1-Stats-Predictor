import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: 'Главная', end: true },
  { to: '/drivers', label: 'Пилоты' },
  { to: '/teams', label: 'Команды' },
  { to: '/calendar', label: 'Календарь' },
  { to: '/standings', label: 'Таблицы' },
  { to: '/predictions', label: 'Прогнозы' },
]

export default function NavBar() {
  return (
    <nav className="flex flex-wrap items-center gap-1">
      {NAV_ITEMS.map((item) => (
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
