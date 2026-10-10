import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { routes } from './app/routes'
import './index.css'
import { instrumentWebGL, perfEnabled } from './perf/perf'
import { ProgressProvider } from './progress/ProgressProvider'

if (perfEnabled && typeof WebGL2RenderingContext !== 'undefined') instrumentWebGL()

const router = createBrowserRouter(routes)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProgressProvider>
      <RouterProvider router={router} />
    </ProgressProvider>
  </StrictMode>,
)
