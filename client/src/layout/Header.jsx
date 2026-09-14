import ThemeToggle from '../components/ThemeToggle'
import NavBar from './NavBar'

export default function Header({ theme, onToggleTheme }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border-soft bg-card/80 backdrop-blur transition-colors dark:border-border-dark dark:bg-card-dark/80">
      <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 font-black text-white" aria-hidden>
            F1
          </span>
          <div>
            <h1 className="text-lg font-extrabold leading-none tracking-tight">
              Simply <span className="text-primary dark:text-accent">Lovely</span>
            </h1>
            <p className="text-xs text-muted dark:text-muted-dark">F1 Stats & Predictor</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <NavBar />
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
    </header>
  )
}
