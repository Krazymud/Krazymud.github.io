import { NavLink, Outlet, useLocation } from 'react-router'
import { useProgress } from '../progress/ProgressProvider'
import { GarageBackdrop, type Scene } from './GarageBackdrop'

const NAV = [
  { to: '/', label: '车库', end: true },
  { to: '/trial', label: '赛道试炼', end: false },
  { to: '/vault', label: '保险库', end: false },
  { to: '/settings', label: '设置', end: false },
]

function sceneFor(pathname: string): Scene {
  if (pathname.startsWith('/vault')) return 'vault'
  if (pathname.startsWith('/trial')) return 'track'
  return 'garage'
}

export function Layout() {
  const { pathname } = useLocation()
  const { saveFailed } = useProgress()
  const scene = sceneFor(pathname)

  return (
    <div data-theme={scene === 'vault' ? 'vault' : undefined} className="relative min-h-dvh bg-ink text-fg">
      <GarageBackdrop scene={scene} />
      <header className="relative z-10 flex items-center justify-between gap-3 px-5 pt-4 text-xs">
        <span className="font-display tracking-[0.35em] text-accent-hi">MIDNIGHT GARAGE</span>
        <nav className="flex gap-4">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'border-b border-accent-hi text-fg' : 'text-muted hover:text-fg')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      {saveFailed && (
        <p role="alert" className="relative z-10 mx-5 mt-3 border border-accent px-3 py-2 text-xs">
          进度暂时无法保存到这台设备，建议去「设置」导出进度。
        </p>
      )}
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-col px-5 pt-6 pb-10">
        <Outlet />
      </main>
    </div>
  )
}
