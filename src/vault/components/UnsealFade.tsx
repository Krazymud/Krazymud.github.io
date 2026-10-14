import { motion } from 'motion/react'
import { useEffect } from 'react'

export const UNSEAL_MS = 400

export function UnsealFade({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, UNSEAL_MS)
    return () => window.clearTimeout(timer)
  }, [onDone])

  return (
    <div
      data-testid="unseal-fade"
      aria-hidden
      onClick={onDone}
      className="fixed inset-0 z-40 cursor-pointer bg-ink/40"
    >
      <motion.div
        className="absolute inset-0 bg-ink"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: UNSEAL_MS / 1000, ease: 'easeOut' }}
      />
    </div>
  )
}
