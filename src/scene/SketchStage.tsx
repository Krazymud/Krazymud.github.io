import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from './hooks'

const base = import.meta.env.BASE_URL
export const ROUTE_FADE_MS = 300
export const DRIVE_STILL = `${base}sketch/fc-drive-still.webp`
export const DRIVE_LOOP = `${base}sketch/fc-drive-loop.webm`
const DRIVE_LOOP_MP4 = `${base}sketch/fc-drive-loop.mp4`

const ambienceClass =
  'sketch-ambience absolute inset-0 z-0 h-full w-full object-cover object-center sm:hidden'

/** Sharp plate lives in a 16:9 wrap so edge masks hit the real content seam. */
const sharpWrapClass =
  'sketch-sharp-wrap absolute inset-x-0 top-1/2 z-[2] w-full -translate-y-1/2 sm:inset-0 sm:top-0 sm:h-full sm:translate-y-0'

const sharpMediaClass =
  'absolute inset-0 h-full w-full object-cover object-center sm:object-[55%_60%]'

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
    document.documentElement.dataset.sketchFit = 'a'
    return () => {
      delete document.documentElement.dataset.sketchFit
    }
  }, [])

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
      data-fit="a"
      className="pointer-events-none fixed inset-0 h-[100dvh] min-h-[100dvh] w-full overflow-hidden bg-ink"
    >
      <div className="sketch-ambience-tint sm:hidden" aria-hidden />
      <img src={DRIVE_STILL} alt="" aria-hidden className={ambienceClass} />
      <div className="sketch-paper-noise sm:hidden" aria-hidden />
      <div className={sharpWrapClass} data-testid="sketch-sharp-wrap">
        <img
          src={DRIVE_STILL}
          alt=""
          aria-hidden
          className={sharpMediaClass}
          style={{ opacity: stillOpacity, transition: fade }}
        />
        {videoMounted ? (
          <video
            ref={videoRef}
            muted
            autoPlay
            playsInline
            {...{ 'webkit-playsinline': '' }}
            preload="auto"
            aria-hidden
            className={sharpMediaClass}
            style={{ opacity: videoOpacity, transition: fade }}
            onError={handleVideoError}
          >
            <source src={DRIVE_LOOP_MP4} type="video/mp4" />
            <source src={DRIVE_LOOP} type="video/webm" />
          </video>
        ) : null}
      </div>
    </div>
  )
}
