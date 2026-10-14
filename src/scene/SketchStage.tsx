import { usePrefersReducedMotion } from './hooks'

const base = import.meta.env.BASE_URL
export const SKETCH_STILL = `${base}sketch/fc-still.webp`
export const SKETCH_LOOP_WEBM = `${base}sketch/fc-loop.webm`
export const SKETCH_LOOP_MP4 = `${base}sketch/fc-loop.mp4`

export function SketchStage() {
  const reduced = usePrefersReducedMotion()
  return (
    <div
      data-testid="sketch-stage"
      data-motion={reduced ? 'still' : 'loop'}
      className="pointer-events-none fixed inset-0 overflow-hidden bg-[#f1ebdd]"
    >
      {reduced ? (
        <img src={SKETCH_STILL} alt="" aria-hidden className="sketch-media" />
      ) : (
        <video
          className="sketch-media"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden
        >
          <source src={SKETCH_LOOP_WEBM} type="video/webm" />
          <source src={SKETCH_LOOP_MP4} type="video/mp4" />
        </video>
      )}
    </div>
  )
}
