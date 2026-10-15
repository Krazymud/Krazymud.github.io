import { motion } from 'motion/react'
import type { Grade } from '../srs'

interface GradeBarProps {
  timeoutMs: number
  onGrade: (grade: Grade) => void
}

export function GradeBar({ timeoutMs, onGrade }: GradeBarProps) {
  return (
    <div className="mt-4">
      <div className="h-0.5 w-full bg-line">
        <motion.div
          className="h-full bg-accent-hi"
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: timeoutMs / 1000, ease: 'linear' }}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button type="button" onClick={() => onGrade('ok')} className="btn-secondary py-3">
          还行
        </button>
        <button type="button" onClick={() => onGrade('good')} className="btn-primary py-3 font-bold">
          会了
        </button>
      </div>
    </div>
  )
}
