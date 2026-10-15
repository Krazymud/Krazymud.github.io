import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePrefersReducedMotion } from './hooks'
import { nudgeWeChatMediaPlay } from './wechatAutoplay'

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

/** Dock (narrow home slot): fill the stage window; same A 融边 mask as bleed. */
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

  useLayoutEffect(() => {
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

function prepareInlineVideo(video: HTMLVideoElement) {
  // iOS Safari + WeChat WKWebView: muted inline before any play() call.
  video.muted = true
  video.defaultMuted = true
  video.playsInline = true
  video.setAttribute('playsinline', '')
  video.setAttribute('webkit-playsinline', '')
  // WeChat X5 / Android WebView helpers (ignored elsewhere).
  video.setAttribute('x5-playsinline', 'true')
  video.setAttribute('x5-video-player-type', 'h5')
  video.setAttribute('x5-video-player-fullscreen', 'false')
}

function tryPlay(video: HTMLVideoElement) {
  prepareInlineVideo(video)
  const playPromise = video.play()
  if (playPromise !== undefined) void playPromise.catch(() => {})
}

function restartLoop(video: HTMLVideoElement) {
  try {
    video.currentTime = 0
  } catch {
    // Ignore seek errors while metadata is not ready.
  }
  tryPlay(video)
}

export function SketchStage({ playLoop }: { playLoop: boolean }) {
  const reduced = usePrefersReducedMotion()
  const narrow = useNarrowViewport()
  const wantLoop = playLoop && !reduced
  // Narrow home always docks into HomePage's stage window (SceneHost mounts before Outlet).
  const needsDock = narrow && playLoop
  const slot = useHomeStageSlot(needsDock)
  const docked = Boolean(slot)
  // Avoid bleed→dock remount: WeChat often blocks the second autoplay without a gesture.
  const readyForVideo = wantLoop && (!needsDock || docked)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fade = `opacity ${ROUTE_FADE_MS}ms ease-in-out`

  const [videoMounted, setVideoMounted] = useState(false)
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
    if (readyForVideo) {
      setLoopDegraded(false)
      setVideoMounted(true)
      // Keep the still until the video is actually playing (WeChat may reject autoplay).
      setLoopFadedIn(false)
      return
    }
    if (wantLoop && needsDock && !docked) {
      setVideoMounted(false)
      setLoopFadedIn(false)
      return
    }
    setLoopFadedIn(false)
    const unmountTimer = window.setTimeout(() => setVideoMounted(false), ROUTE_FADE_MS)
    return () => clearTimeout(unmountTimer)
  }, [readyForVideo, wantLoop, needsDock, docked])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoMounted) return

    prepareInlineVideo(video)

    if (wantLoop) {
      let nudgeTimer: number | undefined
      let nudgeCount = 0
      // Do not stop nudging on the first `playing` event — WeChat/iOS often fire it,
      // paint frame 0, then pause. Only trust sustained progress.
      const PROGRESS_SEC = 0.25
      const MAX_NUDGES = 40

      const markRevealed = () => {
        setLoopFadedIn(true)
      }
      const hasProgress = () =>
        !video.paused && Number.isFinite(video.currentTime) && video.currentTime >= PROGRESS_SEC

      const stopNudge = () => {
        if (nudgeTimer === undefined) return
        window.clearInterval(nudgeTimer)
        nudgeTimer = undefined
      }

      // Reveal whenever the element is actually running — not only on a `playing`
      // event. autoPlay / an earlier tryPlay can start before this effect attaches.
      const revealIfPlaying = () => {
        if (loopDegraded || video.paused) return false
        markRevealed()
        if (hasProgress()) stopNudge()
        return true
      }

      const ensureNudge = () => {
        if (nudgeTimer !== undefined || loopDegraded) return
        nudgeCount = 0
        nudgeTimer = window.setInterval(() => {
          if (!wantLoop || loopDegraded || document.hidden) return
          if (hasProgress()) {
            markRevealed()
            stopNudge()
            return
          }
          if (!video.paused) {
            // Running but still on frame 0 — show the loop and keep polling.
            markRevealed()
            return
          }
          nudgeCount += 1
          tryPlay(video)
          if (nudgeCount >= MAX_NUDGES) stopNudge()
        }, 250)
      }

      const onPlaying = () => {
        markRevealed()
        if (!hasProgress()) ensureNudge()
        else stopNudge()
      }
      const onEnded = () => restartLoop(video)
      const onPause = () => {
        if (!wantLoop || document.hidden || loopDegraded) return
        const atEnd =
          video.ended ||
          (video.duration > 0 &&
            Number.isFinite(video.duration) &&
            video.currentTime >= video.duration - 0.05)
        if (atEnd) {
          restartLoop(video)
          return
        }
        // WeChat often paints frame 0 then pauses muted autoplay — keep nudging.
        tryPlay(video)
        ensureNudge()
      }
      const onCanPlay = () => {
        if (revealIfPlaying()) return
        if (video.paused) tryPlay(video)
      }
      // WeChat / iOS: first autoplay may fail; retry on the next user gesture.
      const onGesture = () => {
        if (wantLoop && !loopDegraded && video.paused) {
          tryPlay(video)
          ensureNudge()
        } else {
          revealIfPlaying()
        }
      }
      const onVisible = () => {
        if (document.visibilityState !== 'visible' || !wantLoop || loopDegraded) return
        if (video.paused) {
          tryPlay(video)
          ensureNudge()
        } else {
          revealIfPlaying()
        }
      }
      const onTimeUpdate = () => {
        if (hasProgress()) {
          markRevealed()
          stopNudge()
        }
      }

      video.addEventListener('playing', onPlaying)
      video.addEventListener('ended', onEnded)
      video.addEventListener('pause', onPause)
      video.addEventListener('canplay', onCanPlay)
      video.addEventListener('loadeddata', onCanPlay)
      video.addEventListener('timeupdate', onTimeUpdate)
      document.addEventListener('touchstart', onGesture, { passive: true, capture: true })
      document.addEventListener('pointerdown', onGesture, { capture: true })
      document.addEventListener('visibilitychange', onVisible)

      tryPlay(video)
      revealIfPlaying()
      ensureNudge()
      const playTimer = window.setTimeout(() => {
        tryPlay(video)
        revealIfPlaying()
        ensureNudge()
      }, ROUTE_FADE_MS)
      // Classic WeChat unlock: invoke getNetworkType on WeixinJSBridgeReady.
      const stopWeChatNudge = nudgeWeChatMediaPlay(() => {
        tryPlay(video)
        revealIfPlaying()
        ensureNudge()
      })

      return () => {
        clearTimeout(playTimer)
        stopNudge()
        stopWeChatNudge()
        video.removeEventListener('playing', onPlaying)
        video.removeEventListener('ended', onEnded)
        video.removeEventListener('pause', onPause)
        video.removeEventListener('canplay', onCanPlay)
        video.removeEventListener('loadeddata', onCanPlay)
        video.removeEventListener('timeupdate', onTimeUpdate)
        document.removeEventListener('touchstart', onGesture, true)
        document.removeEventListener('pointerdown', onGesture, true)
        document.removeEventListener('visibilitychange', onVisible)
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

  const layers = (
    <>
      {/* A 融边: paper tint + blur bed + sharp plate (mask on wrap in bleed, on group in dock). */}
      <div className="sketch-ambience-tint sm:hidden" aria-hidden />
      <img src={DRIVE_STILL} alt="" aria-hidden className={`${ambienceClass} sm:hidden`} />
      <div className="sketch-paper-noise sm:hidden" aria-hidden />
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
            loop
            playsInline
            {...{
              'webkit-playsinline': '',
              'x5-playsinline': 'true',
              'x5-video-player-type': 'h5',
              'x5-video-player-fullscreen': 'false',
            }}
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
    </>
  )

  const stage = (
    <div
      data-testid="sketch-stage"
      data-motion={motion}
      data-route={playLoop ? 'home' : 'inner'}
      data-fit="a"
      data-placement={docked ? 'dock' : 'bleed'}
      data-video-ready={readyForVideo ? '1' : '0'}
      className={
        docked
          ? 'pointer-events-none absolute inset-0 overflow-hidden'
          : 'pointer-events-none fixed inset-0 h-[100dvh] min-h-[100dvh] w-full overflow-hidden bg-ink'
      }
    >
      {docked ? (
        <div className="sketch-a-blend absolute inset-0" data-testid="sketch-a-blend">
          {layers}
        </div>
      ) : (
        layers
      )}
    </div>
  )

  if (docked && slot) return createPortal(stage, slot)
  // While waiting for the home stage slot, keep a bleed still (no video) so WeChat
  // does not autoplay once in bleed and then lose it on portal remount.
  return stage
}
