import { lazy, Suspense } from 'react'
import { Navigate, type RouteObject } from 'react-router'
import { HomePage } from '../pages/HomePage'
import { SettingsPage } from '../pages/SettingsPage'
import { TrialPage } from '../pages/TrialPage'
import { Layout } from './Layout'

const VaultPage = lazy(() => import('../pages/VaultPage').then((m) => ({ default: m.VaultPage })))

const vaultFallback = <p className="mt-10 text-center text-sm text-muted">正在打开保险库…</p>

const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: '/__stills',
        HydrateFallback: () => null,
        lazy: async () => {
          const { StillsPage } = await import('../scene/three/StillsPage')
          return { Component: StillsPage }
        },
      },
    ]
  : []

export const routes: RouteObject[] = [
  ...devRoutes,
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'trial', element: <TrialPage /> },
      {
        path: 'vault',
        element: (
          <Suspense fallback={vaultFallback}>
            <VaultPage />
          </Suspense>
        ),
      },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
