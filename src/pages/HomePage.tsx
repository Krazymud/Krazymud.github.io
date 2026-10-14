import { Link } from 'react-router'
import { play } from '../audio/sound'
import { copy } from '../config/copy'
import { site } from '../config/site'
import { Dashboard } from '../garage/Dashboard'
import { garageStats } from '../garage/stats'
import { useProgress } from '../progress/ProgressProvider'
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

  return (
    <section className="flex min-h-[72dvh] flex-col justify-between">
      <div>
        <p className="font-display text-sm text-muted">{copy.home.eyebrow}</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-wide text-fg">
          {copy.home.hello(site.nickname)}
        </h1>
        {together !== null && (
          <p className="mt-3 text-sm text-muted">{copy.home.together(together)}</p>
        )}
      </div>
      <div className="space-y-3">
        <Dashboard stats={stats} />
        <Link
          to="/trial"
          onClick={() => {
            if (!finished) void play('confirm')
          }}
          className="glass-panel flex items-center justify-between rounded-lg border border-fg/25 px-5 py-4"
        >
          <span>
            <span className="block text-xs text-muted">
              {stats.due > 0 ? copy.home.trialTodayDue(stats.due) : copy.home.trialToday}
            </span>
            <span className="font-display text-2xl font-bold">
              {done} / {total}
            </span>
          </span>
          <span className="text-sm">{finished ? '已完成 · 看结算' : '出发'}</span>
        </Link>
        <div className="flex gap-3">
          <Link to="/vault" className="block flex-1 border border-line px-5 py-3 text-sm text-muted hover:text-fg">
            {copy.home.vaultLink}
          </Link>
        </div>
      </div>
    </section>
  )
}
