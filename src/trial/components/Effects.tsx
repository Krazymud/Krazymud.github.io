import { motion, useReducedMotion } from 'motion/react'

const STREAKS = [0, 1, 2, 3, 4, 5]

export function TrackStreak() {
  const reduced = useReducedMotion()
  if (reduced) return null
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {STREAKS.map((i) => (
        <motion.span
          key={i}
          className="absolute h-px w-1/3 bg-accent-hi"
          style={{ top: `${22 + i * 11}%` }}
          initial={{ x: '120vw', opacity: 0.9 }}
          animate={{ x: '-60vw', opacity: 0 }}
          transition={{ duration: 0.45, delay: i * 0.04, ease: 'easeIn' }}
        />
      ))}
    </div>
  )
}

export function NitroFlash() {
  const reduced = useReducedMotion()
  if (reduced) return null
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0"
      style={{ background: 'radial-gradient(ellipse at 50% 60%, rgba(28, 27, 25, 0.12), transparent 65%)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0] }}
      transition={{ duration: 0.9 }}
    />
  )
}
