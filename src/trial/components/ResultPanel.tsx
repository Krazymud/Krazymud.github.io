import { Link } from 'react-router'
import type { DaySession } from '../../progress/store'

function formatLap(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

interface ResultPanelProps {
  session: DaySession
  dueTomorrow: number
  mastered: number
}

export function ResultPanel({ session, dueTomorrow, mastered }: ResultPanelProps) {
  const total = session.items.length
  if (total === 0) {
    return <p className="mt-10 text-center text-sm text-muted">今天没有要练的词，明天再来。</p>
  }

  const newCount = session.items.filter((item) => item.kind === 'new').length
  const stats = [
    { label: '圈速', value: formatLap((session.finishedAt ?? session.startedAt) - session.startedAt) },
    { label: '正确率', value: `${Math.round((session.correct / total) * 100)}%` },
    { label: '最高连击', value: `×${session.bestCombo}` },
    { label: '新词 / 复习', value: `${newCount} / ${total - newCount}` },
    { label: '已掌握', value: String(mastered) },
    { label: '明天到期', value: String(dueTomorrow) },
  ]

  return (
    <section className="mt-6">
      <p className="text-center font-display text-xs tracking-[0.35em] text-accent-hi">LAP COMPLETE</p>
      <dl className="mt-6 grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="border border-line bg-panel/90 px-4 py-3">
            <dt className="text-xs text-muted">{stat.label}</dt>
            <dd className="mt-1 font-display text-2xl font-bold">{stat.value}</dd>
          </div>
        ))}
      </dl>
      <Link to="/" className="mt-6 block border border-accent-hi bg-accent/20 py-3 text-center">
        回车库
      </Link>
    </section>
  )
}
