import { Outlet } from 'react-router-dom'
import Footer from './Footer'
import Header from './Header'
import { useTheme } from '../hooks/useTheme'

export default function AppLayout() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors dark:bg-background-dark dark:text-foreground-dark">
      <Header theme={theme} onToggleTheme={toggleTheme} />
      <main className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
