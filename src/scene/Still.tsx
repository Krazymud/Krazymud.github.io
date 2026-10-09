import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import type { StillScene } from './types'

const FALLBACK = 'radial-gradient(ellipse 70% 50% at 50% 30%, #1f1f22 0%, #0a0a0c 60%, #050506 100%)'

export function stillUrl(scene: StillScene, orientation: 'portrait' | 'landscape'): string {
  return `${import.meta.env.BASE_URL}stills/${scene}-${orientation}.webp`
}

function StillImage({ scene }: { scene: StillScene }) {
  const [broken, setBroken] = useState(false)
  if (broken) return null
  return (
    <picture>
      <source media="(orientation: landscape)" srcSet={stillUrl(scene, 'landscape')} />
      <img src={stillUrl(scene, 'portrait')} alt="" onError={() => setBroken(true)} className="h-full w-full object-cover" />
    </picture>
  )
}

export function Still({ scene }: { scene: StillScene }) {
  return (
    <div data-testid="scene-still" className="absolute inset-0" style={{ background: FALLBACK }}>
      <AnimatePresence initial={false}>
        <motion.div
          key={scene}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <StillImage scene={scene} />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
