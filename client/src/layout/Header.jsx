import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'
import LiveIndicator from '../components/LiveIndicator'
import { useAuth } from '../context/useAuth'
import NavBar from './NavBar'

/**
 * Эпик-13 (BUG-01/02, регресс 18.11): sticky-header на всю ширину экрана.
 * Верхний ряд: название прижато к левому краю, счётчик онлайна, тема,
 * имя пользователя и «Выйти» — к правому. Навигация перенесена во второй
 * ряд (`lg+`), чтобы пункты не наслаивались на бренд и действия.
 * До `lg` — бургер и выпадающая панель (закрытие по Esc, фону и переходу).
 */
export default function Header({ theme, onToggleTheme }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  return (
    <header className="sticky top-0 z-40 border-b border-border-soft bg-card/90 backdrop-blur transition-colors dark:border-border-dark dark:bg-card-dark/90">
      {/* Верхний ряд: бренд — левый край, действия — правый край экрана */}
      <div className="flex h-14 w-full items-center justify-between gap-2 px-3 sm:px-4 lg:px-5">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Simply Lovely — на главную">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-black text-white transition-colors dark:bg-accent"
            aria-hidden
          >
            F1
          </span>
          <span className="leading-none">
            <span className="block text-base font-extrabold tracking-tight lg:text-lg">
              Simply <span className="text-primary dark:text-accent">Lovely</span>
            </span>
            <span className="mt-0.5 hidden text-[11px] text-muted dark:text-muted-dark xl:block">
              F1 Stats &amp; Predictor
            </span>
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <LiveIndicator compact className="flex" />
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />

          {user ? (
            <div className="hidden items-center gap-2 border-l border-border-soft pl-2 dark:border-border-dark sm:flex lg:pl-3">
              <span className="max-w-[140px] truncate text-sm font-medium text-foreground dark:text-foreground-dark">
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
            <div className="hidden items-center gap-2 border-l border-border-soft pl-2 dark:border-border-dark sm:flex lg:pl-3">
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

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-soft text-foreground transition-colors hover:bg-background dark:border-border-dark dark:text-foreground-dark dark:hover:bg-background-dark lg:hidden"
          >
            {menuOpen ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Второй ряд: навигация больше не конкурирует за место с брендом и действиями */}
      <div className="hidden border-t border-border-soft dark:border-border-dark lg:block">
        <div className="flex w-full justify-center overflow-x-auto px-4 lg:px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <NavBar />
        </div>
      </div>

      {menuOpen && (
        <div className="lg:hidden">
          <button
            type="button"
            aria-label="Закрыть меню"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 top-14 z-30 cursor-default bg-black/30 backdrop-blur-[1px]"
          />
          <div
            id="mobile-menu"
            className="fixed inset-x-0 top-14 z-30 max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-border-soft bg-card p-4 shadow-xl dark:border-border-dark dark:bg-card-dark"
          >
            <NavBar variant="mobile" onNavigate={() => setMenuOpen(false)} />

            <div className="mt-3 border-t border-border-soft pt-3 dark:border-border-dark">
              {user ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-medium text-foreground dark:text-foreground-dark">
                    {user.username}
                  </span>
                  <button
                    onClick={() => {
                      logout()
                      setMenuOpen(false)
                    }}
                    className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/10"
                  >
                    Выйти
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-lg border border-border-soft px-3 py-2 text-center text-sm font-semibold text-foreground transition-colors hover:bg-background dark:border-border-dark dark:text-foreground-dark dark:hover:bg-background-dark"
                  >
                    Войти
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-lg bg-primary px-3 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-hover dark:bg-accent dark:hover:bg-accent-hover"
                  >
                    Регистрация
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
