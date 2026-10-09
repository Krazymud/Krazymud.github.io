import { Navigate, type RouteObject } from 'react-router'
import { HomePage } from '../pages/HomePage'
import { SettingsPage } from '../pages/SettingsPage'
import { TrialPage } from '../pages/TrialPage'
import { VaultPage } from '../pages/VaultPage'
import { Layout } from './Layout'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'trial', element: <TrialPage /> },
      { path: 'vault', element: <VaultPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
