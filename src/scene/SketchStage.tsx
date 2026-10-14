import { usePrefersReducedMotion } from './hooks'

const base = import.meta.env.BASE_URL
export const SKETCH_STILL = `${base}sketch/fc-still.svg`
// 占位：当前为 fc-still.svg。石墨成片（fc-loop / fc-still .webp）交付后，在此改指向并更新说明。
export const SKETCH_LOOP = SKETCH_STILL

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
        className={`h-full w-full object-cover ${reduced ? '' : 'sketch-breathe'}`}
      />
    </div>
  )
}
