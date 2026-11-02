import { Link } from 'react-router'
import { play } from '../audio/sound'
import { copy } from '../config/copy'
import { site } from '../config/site'
import { Dashboard } from '../garage/Dashboard'
import { garageStats } from '../garage/stats'
import { useProgress } from '../progress/ProgressProvider'
import { HOME_STAGE_ATTR } from '../scene/SketchStage'
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
  const glazeFill = total > 0 ? Math.min(1, done / total) : 0

  return (
    <section className="relative">
      <div
        data-testid="home-hero"
        className="relative flex flex-col pb-4 sm:min-h-[70dvh] sm:justify-end sm:pb-8"
      >
        <div className="pointer-events-none absolute inset-0 -mx-5 home-hero-fade max-sm:hidden" aria-hidden />
        <div className="relative">
          <h1 className="font-display text-6xl font-bold tracking-[0.2em] text-fg sm:text-7xl">
            {copy.siteName}
          </h1>
          <p className="mt-4 text-xl text-fg">{copy.home.hello(site.nickname)}</p>
          {together !== null && (
            <p className="mt-2 text-sm text-muted">{copy.home.together(together)}</p>
          )}
          <Link
            to="/trial"
            onClick={() => {
              if (!finished) void play('confirm')
            }}
            style={{ ['--glaze-fill' as string]: String(glazeFill) }}
            className="glaze-cta glass-panel mt-7 inline-flex items-center gap-4 rounded-md border border-line/80 px-5 py-3.5"
          >
            <span className="text-sm tracking-wide">
              {stats.due > 0 ? copy.home.trialTodayDue(stats.due) : copy.home.trialToday}
              {' · '}
              {finished ? '看结算' : '出发'}
            </span>
            <span className="font-display text-xl font-bold tabular-nums tracking-wider">
              {done} / {total}
            </span>
          </Link>
        </div>
      </div>

      <div
        data-testid="home-stage"
        {...{ [HOME_STAGE_ATTR]: '' }}
        className="relative -mx-5 my-1 aspect-video overflow-hidden sm:hidden"
      />

      <div
        data-testid="home-below"
        className="space-y-3 pt-3 max-sm:glass-panel max-sm:rounded-md max-sm:px-4 max-sm:py-4 sm:pt-2"
      >
        <Dashboard stats={stats} />
        <Link
          to="/vault"
          className="block border-b border-line/70 px-1 py-3 text-sm text-muted transition-colors hover:text-fg"
        >
          {copy.home.vaultLink}
        </Link>
      </div>
    </section>
  )
}
