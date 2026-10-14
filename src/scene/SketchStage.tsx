import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePrefersReducedMotion } from './hooks'

const base = import.meta.env.BASE_URL
export const ROUTE_FADE_MS = 300
export const DRIVE_STILL = `${base}sketch/fc-drive-still.webp`
export const DRIVE_LOOP = `${base}sketch/fc-drive-loop.webm`
const DRIVE_LOOP_MP4 = `${base}sketch/fc-drive-loop.mp4`

/** HomePage mounts this on narrow viewports as the drive-loop window. */
export const HOME_STAGE_ATTR = 'data-home-stage'
export const NARROW_MAX_WIDTH_MQ = '(max-width: 639px)'

const ambienceClass =
  'sketch-ambience absolute inset-0 z-0 h-full w-full object-cover object-center'

/** Bleed (desktop / inner): 16:9 wrap centered in the viewport. */
const sharpWrapBleedClass =
  'sketch-sharp-wrap absolute inset-x-0 top-1/2 z-[2] w-full -translate-y-1/2 sm:inset-0 sm:top-0 sm:h-full sm:translate-y-0'

/** Dock (narrow home slot): fill the stage window. */
const sharpWrapDockClass = 'sketch-sharp-wrap sketch-sharp-wrap-dock absolute inset-0 z-[2]'

const sharpMediaClass =
  'absolute inset-0 h-full w-full object-cover object-center sm:object-[55%_60%]'

function useNarrowViewport() {
  const [narrow, setNarrow] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
    return window.matchMedia(NARROW_MAX_WIDTH_MQ).matches
  })

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(NARROW_MAX_WIDTH_MQ)
    const sync = () => setNarrow(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return narrow
}

function useHomeStageSlot(enabled: boolean) {
  const [slot, setSlot] = useState<Element | null>(null)

  useEffect(() => {
    if (!enabled) {
      setSlot(null)
      return
    }

    const sync = () => setSlot(document.querySelector(`[${HOME_STAGE_ATTR}]`))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [enabled])

  return slot
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
  const slot = useHomeStageSlot(narrow && playLoop)
  const docked = Boolean(slot)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fade = `opacity ${ROUTE_FADE_MS}ms ease-in-out`

  const [videoMounted, setVideoMounted] = useState(wantLoop)
  const [loopFadedIn, setLoopFadedIn] = useState(false)
  const [loopDegraded, setLoopDegraded] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.sketchFit = 'a'
    document.documentElement.dataset.sketchPlacement = docked ? 'dock' : 'bleed'
    return () => {
      delete document.documentElement.dataset.sketchFit
      delete document.documentElement.dataset.sketchPlacement
    }
  }, [docked])

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
  }, [wantLoop, videoMounted, loopDegraded, docked])

  const loopVisible = wantLoop && loopFadedIn && !loopDegraded
  const stillOpacity = loopVisible ? 0 : 1
  const videoOpacity = loopVisible ? 1 : 0
  const motion = wantLoop && !loopDegraded ? 'loop' : 'still'

  const handleVideoError = () => {
    setLoopFadedIn(false)
    setLoopDegraded(true)
  }

  const stage = (
    <div
      data-testid="sketch-stage"
      data-motion={motion}
      data-route={playLoop ? 'home' : 'inner'}
      data-fit="a"
      data-placement={docked ? 'dock' : 'bleed'}
      className={
        docked
          ? 'pointer-events-none absolute inset-0 overflow-hidden bg-ink'
          : 'pointer-events-none fixed inset-0 h-[100dvh] min-h-[100dvh] w-full overflow-hidden bg-ink'
      }
    >
      {!docked ? <div className="sketch-ambience-tint sm:hidden" aria-hidden /> : null}
      <img
        src={DRIVE_STILL}
        alt=""
        aria-hidden
        className={`${ambienceClass}${docked ? '' : ' sm:hidden'}`}
      />
      <div className={`sketch-paper-noise${docked ? '' : ' sm:hidden'}`} aria-hidden />
      <div
        className={docked ? sharpWrapDockClass : sharpWrapBleedClass}
        data-testid="sketch-sharp-wrap"
      >
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

  if (docked && slot) return createPortal(stage, slot)
  return stage
}
