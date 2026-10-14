import { usePrefersReducedMotion } from './hooks'

const base = import.meta.env.BASE_URL
export const SKETCH_STILL = `${base}sketch/fc-still.webp`
export const SKETCH_LOOP = `${base}sketch/fc-loop.webp`

export function SketchStage() {
  const reduced = usePrefersReducedMotion()
  return (
    <div
      data-testid="sketch-stage"
      data-motion={reduced ? 'still' : 'loop'}
      className="pointer-events-none fixed inset-0 overflow-hidden bg-[#f1ebdd]"
    >
      <img
        src={reduced ? SKETCH_STILL : SKETCH_LOOP}
        alt=""
        aria-hidden
        className="h-full w-full object-cover"
      />
    </div>
  )
}
