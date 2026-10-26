import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { RequireAuth, RequireAdmin, RequireGuest } from './components/RequireAuth'
import AppLayout from './layout/AppLayout'
import Spinner from './components/ui/Spinner'
import DashboardPage from './pages/DashboardPage'

// Code-splitting (эпик-09): каждая страница — отдельный чанк, подтягивается при навигации.
// Dashboard (landing) остаётся в основном чанке — чтобы не было водопада на первом экране.
const PilotsPage = lazy(() => import('./pages/PilotsPage'))
const DriverDetailPage = lazy(() => import('./pages/DriverDetailPage'))
const TeamsPage = lazy(() => import('./pages/TeamsPage'))
const TeamDetailPage = lazy(() => import('./pages/TeamDetailPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const StandingsPage = lazy(() => import('./pages/StandingsPage'))
const PredictionsPage = lazy(() => import('./pages/PredictionsPage'))
const VotePage = lazy(() => import('./pages/VotePage'))
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const VerifyPage = lazy(() => import('./pages/VerifyPage'))
const CabinetPage = lazy(() => import('./pages/CabinetPage'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminDrivers = lazy(() => import('./pages/admin/AdminDrivers'))
const AdminTeams = lazy(() => import('./pages/admin/AdminTeams'))
const AdminRaces = lazy(() => import('./pages/admin/AdminRaces'))
const AdminResults = lazy(() => import('./pages/admin/AdminResults'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const AdminSync = lazy(() => import('./pages/admin/AdminSync'))

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'drivers', element: <PilotsPage /> },
      { path: 'drivers/:id', element: <DriverDetailPage /> },
      { path: 'teams', element: <TeamsPage /> },
      { path: 'teams/:id', element: <TeamDetailPage /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'standings', element: <StandingsPage /> },
      { path: 'predictions', element: <PredictionsPage /> },
      { path: 'vote', element: <VotePage /> },
      { path: 'leaderboard', element: <LeaderboardPage /> },

      {
        element: <RequireGuest />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
        ],
      },

      {
        path: 'verify',
        element: <VerifyPage />,
      },

      {
        element: <RequireAuth />,
        children: [
          { path: 'cabinet', element: <CabinetPage /> },
        ],
      },

      {
        element: <RequireAdmin />,
        children: [
          {
            path: 'admin',
            element: <AdminLayout />,
            children: [
              { index: true, element: <AdminDrivers /> },
              { path: 'drivers', element: <AdminDrivers /> },
              { path: 'teams', element: <AdminTeams /> },
              { path: 'races', element: <AdminRaces /> },
              { path: 'results', element: <AdminResults /> },
              { path: 'users', element: <AdminUsers /> },
              { path: 'sync', element: <AdminSync /> },
            ],
          },
        ],
      },
    ],
  },
])

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner label="Загрузка…" />
        </div>
      }
    >
      <RouterProvider router={router} />
    </Suspense>
  )
}
