import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router'
import { play } from '../audio/sound'
import { site } from '../config/site'
import { Dashboard } from '../garage/Dashboard'
import { ModsPanel } from '../garage/ModsPanel'
import { garageStats } from '../garage/stats'
import { useProgress } from '../progress/ProgressProvider'
import { useLoading } from '../scene/loading'
import { daysBetween, studyDay } from '../trial/day'
import { isFinished } from '../trial/engine'
import { DAILY_LIMIT } from '../trial/session'

export function HomePage() {
  const { data } = useProgress()
  const today = studyDay(new Date())
  const session = data.session?.day === today ? data.session : undefined
  const done = session?.cursor ?? 0
  const total = session?.items.length ?? DAILY_LIMIT
  const finished = session !== undefined && isFinished(session)
  const together = site.togetherSince ? daysBetween(site.togetherSince, today) + 1 : null
  const stats = garageStats(data, today)
  const loading = useLoading()
  const sceneLive = loading.kind === '3d' && loading.fraction === 1
  const [modding, setModding] = useState(false)
  const modsButton = useRef<HTMLButtonElement>(null)
  const closeMods = useCallback(() => {
    setModding(false)
    modsButton.current?.focus()
  }, [])

  return (
    <section className="flex min-h-[72dvh] flex-col justify-between">
      <div>
        <p className="font-display text-xs tracking-[0.35em] text-muted">WELCOME BACK</p>
        <h1 className="mt-2 font-display text-5xl font-bold tracking-wide">
          HELLO, <span className="text-accent-hi">{site.nickname}</span>
        </h1>
        {together !== null && (
          <p className="mt-3 text-sm text-muted">
            在一起第 <span className="font-display text-lg text-fg">{together}</span> 天
          </p>
        )}
      </div>
      <div className="space-y-3">
        <Dashboard stats={stats} />
        <Link
          to="/trial"
          onClick={() => {
            if (!finished) void play('blip')
          }}
          className="flex items-center justify-between border border-accent-hi bg-accent/20 px-5 py-4"
        >
          <span>
            <span className="block text-xs text-muted">{stats.due > 0 ? `今日试炼 · 到期 ${stats.due}` : '今日试炼'}</span>
            <span className="font-display text-2xl font-bold">
              {done} / {total}
            </span>
          </span>
          <span className="text-sm">{finished ? '已完成 · 看结算' : '出发'}</span>
        </Link>
        <div className="flex gap-3">
          <Link to="/vault" className="block flex-1 border border-line px-5 py-3 text-sm text-muted hover:text-fg">
            保险库
          </Link>
          {sceneLive && (
            <button
              ref={modsButton}
              type="button"
              onClick={() => setModding(true)}
              className="border border-line px-5 py-3 text-sm text-muted hover:text-fg"
            >
              改装
            </button>
          )}
        </div>
      </div>
      {modding && <ModsPanel onClose={closeMods} />}
    </section>
  )
}
