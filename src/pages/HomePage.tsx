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
    <section className="flex min-h-[72dvh] flex-col">
      {/* 首屏一构图：品牌 → 问候 → 辅文 → 主 CTA */}
      <div className="flex min-h-[58dvh] flex-col justify-between pb-8">
        <div>
          <h1 className="font-display text-5xl font-bold tracking-wide text-fg sm:text-6xl">{copy.siteName}</h1>
          <p className="mt-5 font-display text-xl text-fg/90">
            <span className="text-muted">{copy.home.eyebrow}</span>
            <span className="mx-2 text-line">·</span>
            {copy.home.hello(site.nickname)}
          </p>
          {together !== null && <p className="mt-3 text-sm text-muted">{copy.home.together(together)}</p>}
        </div>
        <Link
          to="/trial"
          onClick={() => {
            if (!finished) void play('confirm')
          }}
          className="glass-panel mt-10 flex items-center justify-between rounded-[var(--radius-panel)] border border-fg/15 px-5 py-4"
        >
          <span>
            <span className="block text-xs text-muted">
              {stats.due > 0 ? copy.home.trialTodayDue(stats.due) : copy.home.trialToday}
            </span>
            <span className="mt-1 block font-display text-2xl font-bold tabular-nums">
              {done} / {total}
            </span>
          </span>
          <span className="text-sm text-fg">{finished ? '已完成 · 看结算' : '出发'}</span>
        </Link>
      </div>

      {/* 第二折：轻仪表与次入口，不抢首屏 */}
      <div className="space-y-3 border-t border-line/70 pt-6">
        <Dashboard stats={stats} />
        <Link
          to="/vault"
          className="block rounded-[var(--radius-panel)] border border-line bg-ink/40 px-5 py-3 text-sm text-muted hover:border-fg/25 hover:text-fg"
        >
          {copy.home.vaultLink}
        </Link>
      </div>
    </section>
  )
}
