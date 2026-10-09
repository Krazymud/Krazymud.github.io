import { motion, useReducedMotion } from 'motion/react'

export function GoldSweep() {
  const reduced = useReducedMotion()
  if (reduced) return null
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-20"
      style={{ background: 'linear-gradient(100deg, transparent 30%, rgba(191, 159, 98, 0.35) 50%, transparent 70%)' }}
      initial={{ x: '-100%', opacity: 1 }}
      animate={{ x: '100%', opacity: 0 }}
      transition={{ duration: 0.9, ease: 'easeOut' }}
    />
  )
}
