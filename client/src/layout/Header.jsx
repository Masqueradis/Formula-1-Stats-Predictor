import { Link } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'
import NavBar from './NavBar'

export default function Header({ theme, onToggleTheme }) {
  const { user, logout } = useAuth()

  return (
    <header className="sticky top-0 z-10 border-b border-border-soft bg-card/80 backdrop-blur transition-colors dark:border-border-dark dark:bg-card-dark/80">
      <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-black text-white transition-colors dark:bg-accent" aria-hidden>
            F1
          </span>
          <div>
            <h1 className="text-lg font-extrabold leading-none tracking-tight">
              Simply <span className="text-primary dark:text-accent">Lovely</span>
            </h1>
            <p className="text-xs text-muted dark:text-muted-dark">F1 Stats & Predictor</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <NavBar />
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />

          {user ? (
            <div className="flex items-center gap-2 border-l border-border-soft pl-3 dark:border-border-dark">
              <span className="hidden text-sm font-medium text-foreground dark:text-foreground-dark sm:block">
                {user.username}
              </span>
              <button
                onClick={logout}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/10"
              >
                Выйти
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 border-l border-border-soft pl-3 dark:border-border-dark">
              <Link
                to="/login"
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground dark:text-muted-dark dark:hover:text-foreground-dark"
              >
                Войти
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-hover dark:bg-accent dark:hover:bg-accent-hover"
              >
                Регистрация
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}