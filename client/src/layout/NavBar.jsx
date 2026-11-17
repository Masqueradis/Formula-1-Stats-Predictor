import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

const PUBLIC_ITEMS = [
  { to: '/', label: 'Главная', short: 'Главная', end: true },
  { to: '/drivers', label: 'Пилоты' },
  { to: '/teams', label: 'Команды' },
  { to: '/calendar', label: 'Календарь' },
  { to: '/history', label: 'История' },
  { to: '/standings', label: 'Турнирная таблица', short: 'Таблица' },
  { to: '/predictions', label: 'Прогнозы' },
  { to: '/vote', label: 'Голосование', short: 'Голос' },
  { to: '/leaderboard', label: 'Рейтинг' },
]

const DESKTOP_LINK =
  'whitespace-nowrap rounded-lg px-2 py-1.5 text-[13px] font-medium transition-colors xl:px-3 xl:text-sm'
const MOBILE_LINK =
  'block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors'

const ACTIVE = 'bg-primary text-white dark:bg-accent'
const IDLE =
  'text-muted hover:bg-background hover:text-foreground dark:text-muted-dark dark:hover:bg-background-dark dark:hover:text-foreground-dark'

export default function NavBar({ variant = 'desktop', onNavigate }) {
  const { user } = useAuth()

  const items = [
    ...PUBLIC_ITEMS,
    ...(user ? [{ to: '/cabinet', label: 'Кабинет' }] : []),
    ...(user?.role === 'ADMIN' ? [{ to: '/admin', label: 'Админ' }] : []),
  ]

  if (variant === 'mobile') {
    return (
      <nav className="flex flex-col gap-0.5" aria-label="Основная навигация">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) => `${MOBILE_LINK} ${isActive ? ACTIVE : IDLE}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    )
  }

  return (
    <nav className="hidden flex-nowrap items-center gap-0.5 lg:flex" aria-label="Основная навигация">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `${DESKTOP_LINK} ${isActive ? ACTIVE : IDLE}`}
        >
          {item.short ? (
            <>
              <span className="xl:hidden">{item.short}</span>
              <span className="hidden xl:inline">{item.label}</span>
            </>
          ) : (
            item.label
          )}
        </NavLink>
      ))}
    </nav>
  )
}
