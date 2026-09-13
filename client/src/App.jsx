import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import AppLayout from './layout/AppLayout'
import CalendarPage from './pages/CalendarPage'
import DashboardPage from './pages/DashboardPage'
import PilotsPage from './pages/PilotsPage'
import PredictionsPage from './pages/PredictionsPage'
import StandingsPage from './pages/StandingsPage'
import TeamsPage from './pages/TeamsPage'

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
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
