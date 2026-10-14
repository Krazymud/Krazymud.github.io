import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from './hooks'

const base = import.meta.env.BASE_URL
export const ROUTE_FADE_MS = 300
export const DRIVE_STILL = `${base}sketch/fc-drive-still.webp`
export const DRIVE_STILL_PORTRAIT = `${base}sketch/fc-drive-still-portrait.webp`
export const DRIVE_LOOP = `${base}sketch/fc-drive-loop.webm`
export const DRIVE_LOOP_PORTRAIT = `${base}sketch/fc-drive-loop-portrait.webm`
const DRIVE_LOOP_MP4 = `${base}sketch/fc-drive-loop.mp4`
const DRIVE_LOOP_PORTRAIT_MP4 = `${base}sketch/fc-drive-loop-portrait.mp4`

/** Tailwind `sm` breakpoint — below this we use the 9:16 plate. */
export const NARROW_MAX_WIDTH_MQ = '(max-width: 639px)'

const layerClass =
  'absolute inset-0 h-full w-full object-cover object-center sm:object-[55%_60%]'

function useNarrowViewport() {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(NARROW_MAX_WIDTH_MQ).matches : true,
  )

  useEffect(() => {
    const mq = window.matchMedia(NARROW_MAX_WIDTH_MQ)
    const sync = () => setNarrow(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return narrow
}

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
  const narrow = useNarrowViewport()
  const wantLoop = playLoop && !reduced
  const videoRef = useRef<HTMLVideoElement>(null)
  const fade = `opacity ${ROUTE_FADE_MS}ms ease-in-out`

  const [videoMounted, setVideoMounted] = useState(wantLoop)
  const [loopFadedIn, setLoopFadedIn] = useState(false)
  const [loopDegraded, setLoopDegraded] = useState(false)

  const stillSrc = narrow ? DRIVE_STILL_PORTRAIT : DRIVE_STILL
  const loopMp4 = narrow ? DRIVE_LOOP_PORTRAIT_MP4 : DRIVE_LOOP_MP4
  const loopWebm = narrow ? DRIVE_LOOP_PORTRAIT : DRIVE_LOOP

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
  }, [wantLoop, videoMounted, loopDegraded, narrow])

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
      data-plate={narrow ? 'portrait' : 'landscape'}
      className="pointer-events-none fixed inset-0 h-[100dvh] min-h-[100dvh] w-full overflow-hidden bg-ink"
    >
      <img
        src={stillSrc}
        alt=""
        aria-hidden
        className={layerClass}
        style={{ opacity: stillOpacity, transition: fade }}
      />
      {videoMounted ? (
        <video
          key={narrow ? 'portrait' : 'landscape'}
          ref={videoRef}
          muted
          autoPlay
          playsInline
          {...{ 'webkit-playsinline': '' }}
          preload="auto"
          aria-hidden
          className={layerClass}
          style={{ opacity: videoOpacity, transition: fade }}
          onError={handleVideoError}
        >
          <source src={loopMp4} type="video/mp4" />
          <source src={loopWebm} type="video/webm" />
        </video>
      ) : null}
    </div>
  )
}
