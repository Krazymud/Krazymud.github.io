import { motion, useReducedMotion } from 'motion/react'

export function PaperPulse() {
  const reduced = useReducedMotion()
  if (reduced) return null
  return (
    <motion.div
      aria-hidden
      data-testid="paper-pulse"
      className="pointer-events-none fixed inset-0"
      style={{ background: 'radial-gradient(ellipse at 50% 55%, color-mix(in srgb, var(--color-ink) 18%, transparent), transparent 65%)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.85, 0] }}
      transition={{ duration: 0.38 }}
    />
  )
}
