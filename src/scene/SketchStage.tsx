import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from './hooks'

const base = import.meta.env.BASE_URL
export const ROUTE_FADE_MS = 300
export const DRIVE_STILL = `${base}sketch/fc-drive-still.webp`
export const DRIVE_LOOP = `${base}sketch/fc-drive-loop.webm`
const DRIVE_LOOP_MP4 = `${base}sketch/fc-drive-loop.mp4`

const layerClass = 'absolute inset-0 h-full w-full object-cover object-[55%_60%]'

export function SketchStage({ playLoop }: { playLoop: boolean }) {
  const reduced = usePrefersReducedMotion()
  const wantLoop = playLoop && !reduced
  const videoRef = useRef<HTMLVideoElement>(null)
  const fade = `opacity ${ROUTE_FADE_MS}ms ease-in-out`

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (wantLoop) {
      const playPromise = video.play()
      if (playPromise !== undefined) void playPromise.catch(() => {})
    } else {
      video.pause()
    }
  }, [wantLoop])

  return (
    <div
      data-testid="sketch-stage"
      data-motion={wantLoop ? 'loop' : 'still'}
      data-route={playLoop ? 'home' : 'inner'}
      className="pointer-events-none fixed inset-0 overflow-hidden bg-ink"
    >
      <img
        src={DRIVE_STILL}
        alt=""
        aria-hidden
        className={layerClass}
        style={{ opacity: wantLoop ? 0 : 1, transition: fade }}
      />
      {wantLoop ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden
          className={layerClass}
          style={{ opacity: 1, transition: fade }}
        >
          <source src={DRIVE_LOOP} type="video/webm" />
          <source src={DRIVE_LOOP_MP4} type="video/mp4" />
        </video>
      ) : null}
    </div>
  )
}
