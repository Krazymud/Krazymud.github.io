import type { GarageStats } from './stats'

const RADIUS = 26
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function ceilTo(value: number, step: number) {
  return Math.max(step, Math.ceil(value / step) * step)
}

function Ring({ id, fill, value, max, caption, label }: { id: string; fill: number; value: number; max: number; caption: string; label: string }) {
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuetext={label}
      className="flex flex-col items-center gap-1"
    >
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="32" cy="32" r={RADIUS} fill="none" stroke="var(--color-line)" strokeWidth="3" />
          <circle
            data-testid={`ring-${id}`}
            data-fill={String(fill)}
            cx="32"
            cy="32"
            r={RADIUS}
            fill="none"
            stroke="var(--color-accent-hi)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - fill)}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-display text-xl font-bold tabular-nums">{value}</span>
      </div>
      <span className="text-[10px] tracking-[0.3em] text-muted">{caption}</span>
    </div>
  )
}

export function Dashboard({ stats }: { stats: GarageStats }) {
  const streakFill = stats.streak === 0 ? 0 : stats.streak % 7 === 0 ? 1 : (stats.streak % 7) / 7
  const masteredFill = stats.mastered === 0 ? 0 : stats.mastered % 100 === 0 ? 1 : (stats.mastered % 100) / 100
  const lit = stats.week.filter(Boolean).length
  return (
    <div role="group" aria-label="车库仪表" className="flex items-center justify-between border border-line bg-panel/60 px-4 py-3">
      <Ring id="streak" fill={streakFill} value={stats.streak} max={ceilTo(stats.streak, 7)} caption="连续" label={`连续打卡 ${stats.streak} 天`} />
      <div className="flex flex-col items-center gap-2">
        <div role="img" aria-label={`最近 7 天打卡 ${lit} 天`} className="flex gap-2">
          {stats.week.map((done, i) => (
            <span
              key={i}
              data-testid={`day-${i}`}
              className={
                done
                  ? 'h-2.5 w-2.5 rounded-full bg-accent-hi shadow-[0_0_6px_var(--color-accent-hi)]'
                  : i === 6
                    ? 'h-2.5 w-2.5 rounded-full border border-accent-hi animate-breathe'
                    : 'h-2.5 w-2.5 rounded-full border border-line'
              }
            />
          ))}
        </div>
        <span className="text-[10px] tracking-[0.3em] text-muted">本周</span>
      </div>
      <Ring id="mastered" fill={masteredFill} value={stats.mastered} max={ceilTo(stats.mastered, 100)} caption="掌握" label={`已掌握 ${stats.mastered} 个词`} />
    </div>
  )
}
