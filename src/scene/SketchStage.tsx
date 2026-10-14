import { usePrefersReducedMotion } from './hooks'

const base = import.meta.env.BASE_URL
export const SKETCH_STILL = `${base}sketch/fc-still.svg`
// 成片替换点：把 public/sketch/fc-loop.webp 放好后，将下面指向它即可；目前占位阶段循环沿用静帧。
export const SKETCH_LOOP = SKETCH_STILL

const ALT = '青庐车库：RX-7 FC 素描'

export function SketchStage() {
  const reduced = usePrefersReducedMotion()
  return (
    <div
      data-testid="sketch-stage"
      data-motion={reduced ? 'still' : 'loop'}
      aria-hidden={undefined}
      className="pointer-events-none fixed inset-0 overflow-hidden bg-[#f1ebdd]"
    >
      <img
        src={reduced ? SKETCH_STILL : SKETCH_LOOP}
        alt={ALT}
        className={`h-full w-full object-cover ${reduced ? '' : 'sketch-breathe'}`}
      />
    </div>
  )
}
