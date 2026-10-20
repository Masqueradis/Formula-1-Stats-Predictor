import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { RequireAuth, RequireAdmin, RequireGuest } from './components/RequireAuth'
import AppLayout from './layout/AppLayout'
import DashboardPage from './pages/DashboardPage'
import PilotsPage from './pages/PilotsPage'
import DriverDetailPage from './pages/DriverDetailPage'
import TeamsPage from './pages/TeamsPage'
import TeamDetailPage from './pages/TeamDetailPage'
import CalendarPage from './pages/CalendarPage'
import StandingsPage from './pages/StandingsPage'
import PredictionsPage from './pages/PredictionsPage'
import VotePage from './pages/VotePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import VerifyPage from './pages/VerifyPage'
import CabinetPage from './pages/CabinetPage'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDrivers from './pages/admin/AdminDrivers'
import AdminTeams from './pages/admin/AdminTeams'
import AdminResults from './pages/admin/AdminResults'
import AdminUsers from './pages/admin/AdminUsers'
import AdminSync from './pages/admin/AdminSync'

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
  return <RouterProvider router={router} />
}