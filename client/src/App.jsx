import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { RequireAuth, RequireAdmin, RequireGuest } from './components/RequireAuth'
import AppLayout from './layout/AppLayout'
import CalendarPage from './pages/CalendarPage'
import DashboardPage from './pages/DashboardPage'
import PilotsPage from './pages/PilotsPage'
import PredictionsPage from './pages/PredictionsPage'
import StandingsPage from './pages/StandingsPage'
import TeamsPage from './pages/TeamsPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import CabinetPage from './pages/CabinetPage'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDrivers from './pages/admin/AdminDrivers'
import AdminUsers from './pages/admin/AdminUsers'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'drivers', element: <PilotsPage /> },
      { path: 'teams', element: <TeamsPage /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'standings', element: <StandingsPage /> },
      { path: 'predictions', element: <PredictionsPage /> },

      {
        element: <RequireGuest />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
        ],
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
              { path: 'users', element: <AdminUsers /> },
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