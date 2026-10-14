import { useEffect, useRef, useState } from 'react'
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

  const [videoMounted, setVideoMounted] = useState(wantLoop)
  const [loopFadedIn, setLoopFadedIn] = useState(false)

  useEffect(() => {
    if (wantLoop) {
      setVideoMounted(true)
      setLoopFadedIn(false)
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setLoopFadedIn(true))
      })
      return () => cancelAnimationFrame(frame)
    }
    setLoopFadedIn(false)
    const unmountTimer = window.setTimeout(() => setVideoMounted(false), ROUTE_FADE_MS)
    return () => clearTimeout(unmountTimer)
  }, [wantLoop])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoMounted) return

    if (wantLoop) {
      const playTimer = window.setTimeout(() => {
        const playPromise = video.play()
        if (playPromise !== undefined) void playPromise.catch(() => {})
      }, ROUTE_FADE_MS)
      return () => clearTimeout(playTimer)
    }

    const pauseTimer = window.setTimeout(() => {
      video.pause()
    }, ROUTE_FADE_MS)
    return () => clearTimeout(pauseTimer)
  }, [wantLoop, videoMounted])

  const stillOpacity = wantLoop && loopFadedIn ? 0 : 1
  const videoOpacity = wantLoop && loopFadedIn ? 1 : 0

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
        style={{ opacity: stillOpacity, transition: fade }}
      />
      {videoMounted ? (
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          aria-hidden
          className={layerClass}
          style={{ opacity: videoOpacity, transition: fade }}
        >
          <source src={DRIVE_LOOP} type="video/webm" />
          <source src={DRIVE_LOOP_MP4} type="video/mp4" />
        </video>
      ) : null}
    </div>
  )
}
