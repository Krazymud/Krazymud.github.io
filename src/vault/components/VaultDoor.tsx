import { motion } from 'motion/react'
import { useEffect } from 'react'

export const DOOR_MS = 1600

const BOLTS = [0, 45, 90, 135, 180, 225, 270, 315]
const SPOKES = [0, 120, 240]

export function VaultDoor({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, DOOR_MS)
    return () => window.clearTimeout(timer)
  }, [onDone])

  return (
    <div
      data-testid="vault-door"
      aria-hidden
      onClick={onDone}
      className="fixed inset-0 z-40 flex cursor-pointer items-center justify-center [perspective:1200px]"
    >
      <motion.div
        className="absolute inset-0 bg-ink"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ delay: 0.8, duration: 0.8 }}
      />
      <motion.svg
        viewBox="-100 -100 200 200"
        className="relative w-[min(80vw,80vh)] text-accent-hi"
        style={{ transformOrigin: 'left center' }}
        initial={{ rotateY: 0 }}
        animate={{ rotateY: -100 }}
        transition={{ delay: 0.8, duration: 0.8, ease: 'easeIn' }}
      >
        <circle r={96} fill="none" stroke="currentColor" strokeWidth={4} />
        {BOLTS.map((angle) => (
          <g key={angle} transform={`rotate(${angle})`}>
            <motion.rect
              x={-5}
              width={10}
              height={16}
              fill="currentColor"
              initial={{ attrY: -94 }}
              animate={{ attrY: -80 }}
              transition={{ delay: 0.5, duration: 0.3 }}
            />
          </g>
        ))}
        <circle r={82} fill="var(--color-panel)" stroke="currentColor" strokeWidth={2} />
        <circle r={70} fill="none" stroke="var(--color-line)" strokeWidth={1.5} />
        <motion.g initial={{ rotate: 0 }} animate={{ rotate: 270 }} transition={{ duration: 0.5, ease: 'easeInOut' }}>
          <circle r={44} fill="none" stroke="currentColor" strokeWidth={3} />
          {SPOKES.map((angle) => (
            <line
              key={angle}
              x2={0}
              y2={-44}
              stroke="currentColor"
              strokeWidth={6}
              strokeLinecap="round"
              transform={`rotate(${angle})`}
            />
          ))}
          <circle r={12} fill="currentColor" />
        </motion.g>
      </motion.svg>
    </div>
  )
}
