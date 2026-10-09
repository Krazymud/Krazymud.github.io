import { motion } from 'motion/react'

const ARC = 'M20 105 A80 80 0 0 1 180 105'

interface GaugeProps {
  value: number
  total: number
  combo: number
  boost: boolean
}

export function Gauge({ value, total, combo, boost }: GaugeProps) {
  const fraction = total > 0 ? Math.min(value / total, 1) : 0
  const angle = -90 + 180 * fraction + (boost ? 14 : 0)

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="w-48" role="img" aria-label={`进度 ${value} / ${total}`}>
        <path d={ARC} fill="none" stroke="var(--color-line)" strokeWidth="10" strokeLinecap="round" />
        <motion.path
          d={ARC}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="10"
          strokeLinecap="round"
          initial={false}
          animate={{ pathLength: fraction }}
          transition={{ duration: 0.5 }}
        />
        <motion.g
          style={{ transformBox: 'fill-box', originX: 0.5, originY: 1 }}
          initial={false}
          animate={{ rotate: angle }}
          transition={{ type: 'spring', stiffness: 160, damping: 14 }}
        >
          <line x1="100" y1="105" x2="100" y2="42" stroke="var(--accent-hi)" strokeWidth="2.5" />
        </motion.g>
        <circle cx="100" cy="105" r="5" fill="var(--accent-hi)" />
        <text x="100" y="88" textAnchor="middle" fill="var(--color-fg)" fontSize="22" fontWeight="700" className="font-display">
          {value}
          <tspan fontSize="11" fill="var(--color-muted)">
            {' '}
            / {total}
          </tspan>
        </text>
      </svg>
      <p className="-mt-1 font-display text-xs tracking-[0.2em] text-accent-hi">COMBO ×{combo}</p>
    </div>
  )
}
