import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from './hooks'

const base = import.meta.env.BASE_URL
export const ROUTE_FADE_MS = 300
export const DRIVE_STILL = `${base}sketch/fc-drive-still.webp`
export const DRIVE_LOOP = `${base}sketch/fc-drive-loop.webm`
const DRIVE_LOOP_MP4 = `${base}sketch/fc-drive-loop.mp4`

// Phone portrait: contain so the full RX-7 stays in frame (cover crops it on tall viewports).
// sm+: cover the stage; keep a nose-biased crop for desktop.
const layerClass =
  'absolute inset-0 h-full w-full object-contain object-center sm:object-cover sm:object-[55%_60%]'

function restartLoop(video: HTMLVideoElement) {
  try {
    video.currentTime = 0
  } catch {
    // Ignore seek errors while metadata is not ready.
  }
  const playPromise = video.play()
  if (playPromise !== undefined) void playPromise.catch(() => {})
}

export function SketchStage({ playLoop }: { playLoop: boolean }) {
  const reduced = usePrefersReducedMotion()
  const wantLoop = playLoop && !reduced
  const videoRef = useRef<HTMLVideoElement>(null)
  const fade = `opacity ${ROUTE_FADE_MS}ms ease-in-out`

  const [videoMounted, setVideoMounted] = useState(wantLoop)
  const [loopFadedIn, setLoopFadedIn] = useState(false)
  const [loopDegraded, setLoopDegraded] = useState(false)

  useEffect(() => {
    if (wantLoop) {
      setLoopDegraded(false)
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

    // iOS Safari: keep muted + inline before any play() call.
    video.muted = true
    video.defaultMuted = true
    video.playsInline = true
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')

    if (wantLoop) {
      const playTimer = window.setTimeout(() => {
        const playPromise = video.play()
        if (playPromise !== undefined) void playPromise.catch(() => {})
      }, ROUTE_FADE_MS)

      // Native `loop` is unreliable on iOS (often stops after 1–2 cycles on large files).
      // Omit `loop` so `ended` fires, then manually seek + play. Also recover if Safari
      // pauses at EOF without emitting `ended`.
      const onEnded = () => restartLoop(video)
      const onPause = () => {
        if (!wantLoop || document.hidden || loopDegraded) return
        const atEnd =
          video.ended ||
          (video.duration > 0 &&
            Number.isFinite(video.duration) &&
            video.currentTime >= video.duration - 0.05)
        if (atEnd) restartLoop(video)
      }

      video.addEventListener('ended', onEnded)
      video.addEventListener('pause', onPause)

      return () => {
        clearTimeout(playTimer)
        video.removeEventListener('ended', onEnded)
        video.removeEventListener('pause', onPause)
      }
    }

    const pauseTimer = window.setTimeout(() => {
      video.pause()
    }, ROUTE_FADE_MS)
    return () => clearTimeout(pauseTimer)
  }, [wantLoop, videoMounted, loopDegraded])

  const loopVisible = wantLoop && loopFadedIn && !loopDegraded
  const stillOpacity = loopVisible ? 0 : 1
  const videoOpacity = loopVisible ? 1 : 0
  const motion = wantLoop && !loopDegraded ? 'loop' : 'still'

  const handleVideoError = () => {
    setLoopFadedIn(false)
    setLoopDegraded(true)
  }

  return (
    <div
      data-testid="sketch-stage"
      data-motion={motion}
      data-route={playLoop ? 'home' : 'inner'}
      className="pointer-events-none fixed inset-0 h-[100dvh] min-h-[100dvh] w-full overflow-hidden bg-ink"
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
          autoPlay
          playsInline
          // Keep attribute for older WebKit; React's playsInline maps to playsinline.
          {...{ 'webkit-playsinline': '' }}
          preload="auto"
          aria-hidden
          className={layerClass}
          style={{ opacity: videoOpacity, transition: fade }}
          onError={handleVideoError}
        >
          {/* mp4 first: iOS cannot play webm; listing it first can stall source selection. */}
          <source src={DRIVE_LOOP_MP4} type="video/mp4" />
          <source src={DRIVE_LOOP} type="video/webm" />
        </video>
      ) : null}
    </div>
  )
}
