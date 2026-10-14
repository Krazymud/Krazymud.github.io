import { usePrefersReducedMotion } from './hooks'

const base = import.meta.env.BASE_URL
export const SKETCH_STILL = `${base}sketch/fc-still.webp`
export const SKETCH_UP = `${base}sketch/fc-up.webp`

export function SketchStage() {
  const reduced = usePrefersReducedMotion()
  return (
    <div
      data-testid="sketch-stage"
      data-motion={reduced ? 'still' : 'loop'}
      className="pointer-events-none fixed inset-0 overflow-hidden bg-[#f1ebdd]"
    >
      <img src={SKETCH_STILL} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
      {!reduced && (
        <img
          src={SKETCH_UP}
          alt=""
          aria-hidden
          className="sketch-headlights absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  )
}
