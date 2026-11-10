import { lazy, Suspense } from 'react'
import { Navigate, type RouteObject } from 'react-router'
import { copy } from '../config/copy'
import { Layout } from './Layout'

const DarkroomPage = lazy(() =>
  import('../pages/DarkroomPage').then((m) => ({ default: m.DarkroomPage })),
)

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: (
          <Suspense
            fallback={
              <p className="mt-10 text-center text-sm text-muted">{copy.darkroom.opening}</p>
            }
          >
            <DarkroomPage />
          </Suspense>
        ),
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
