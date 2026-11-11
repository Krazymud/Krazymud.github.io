import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { setPrefs, usePrefs } from '../../prefs/prefs'
import { DEFAULT_PLAYLIST } from './playlist'

export interface ReelRadioContextValue {
  muted: boolean
  volume: number
  trackIndex: number
  trackTitle: string
  armed: boolean
  setVolume: (v: number) => void
  toggleMute: () => void
  next: () => void
  prev: () => void
}

const ReelRadioContext = createContext<ReelRadioContextValue | null>(null)

export function useReelRadio(): ReelRadioContextValue {
  const ctx = useContext(ReelRadioContext)
  if (!ctx) throw new Error('useReelRadio must be used within ReelRadioProvider')
  return ctx
}

const FADE_MS = 900

function playAudio(audio: HTMLAudioElement): Promise<void> {
  try {
    const result = audio.play()
    if (result && typeof (result as Promise<void>).then === 'function') return result as Promise<void>
    return Promise.resolve()
  } catch {
    return Promise.reject(new Error('play failed'))
  }
}

export function ReelRadioProvider({ children }: { children: ReactNode }) {
  const prefs = usePrefs()
  const muted = prefs.muted
  const [volume, setVolumeState] = useState(0.45)
  const [trackIndex, setTrackIndex] = useState(0)
  const [armed, setArmed] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fadeRef = useRef<number | null>(null)
  const loadedIndexRef = useRef<number | null>(null)
  const mutedRef = useRef(muted)
  const volumeRef = useRef(volume)
  const armedRef = useRef(armed)
  mutedRef.current = muted
  volumeRef.current = volume
  armedRef.current = armed

  const track = DEFAULT_PLAYLIST[trackIndex % DEFAULT_PLAYLIST.length]

  const ensureAudio = useCallback(() => {
    let audio = audioRef.current
    if (!audio) {
      audio = new Audio()
      audio.loop = false
      audioRef.current = audio
      audio.addEventListener('ended', () => {
        setTrackIndex((i) => (i + 1) % DEFAULT_PLAYLIST.length)
      })
    }
    return audio
  }, [])

  const applyLevels = useCallback((audio: HTMLAudioElement) => {
    audio.muted = mutedRef.current
    audio.volume = mutedRef.current ? 0 : volumeRef.current
  }, [])

  const fadeIn = useCallback((el: HTMLAudioElement) => {
    if (fadeRef.current) cancelAnimationFrame(fadeRef.current)
    const start = performance.now()
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / FADE_MS)
      if (!mutedRef.current) el.volume = volumeRef.current * t
      if (t < 1) fadeRef.current = requestAnimationFrame(tick)
      else fadeRef.current = null
    }
    fadeRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    const entry = DEFAULT_PLAYLIST[trackIndex % DEFAULT_PLAYLIST.length]
    if (!entry) return
    const audio = ensureAudio()
    if (loadedIndexRef.current !== trackIndex) {
      audio.pause()
      audio.src = entry.src
      loadedIndexRef.current = trackIndex
    }
    applyLevels(audio)
    if (armedRef.current) {
      void playAudio(audio).catch(() => setArmed(false))
    }
  }, [trackIndex, applyLevels, ensureAudio])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    applyLevels(audio)
  }, [muted, volume, applyLevels])

  useEffect(() => {
    if (armed) return
    const kick = () => {
      if (armedRef.current) return
      const entry = DEFAULT_PLAYLIST[trackIndex % DEFAULT_PLAYLIST.length]
      if (!entry) return
      const audio = ensureAudio()
      if (loadedIndexRef.current !== trackIndex) {
        audio.pause()
        audio.src = entry.src
        loadedIndexRef.current = trackIndex
      }
      applyLevels(audio)
      audio.volume = 0
      void playAudio(audio)
        .then(() => {
          setArmed(true)
          fadeIn(audio)
        })
        .catch(() => {
          setArmed(false)
        })
    }
    const opts: AddEventListenerOptions = { capture: true, passive: true }
    window.addEventListener('pointerup', kick, opts)
    window.addEventListener('click', kick, opts)
    window.addEventListener('touchend', kick, opts)
    return () => {
      window.removeEventListener('pointerup', kick, opts)
      window.removeEventListener('click', kick, opts)
      window.removeEventListener('touchend', kick, opts)
    }
  }, [armed, trackIndex, applyLevels, ensureAudio, fadeIn])

  useEffect(() => {
    return () => {
      if (fadeRef.current) cancelAnimationFrame(fadeRef.current)
      audioRef.current?.pause()
    }
  }, [])

  const setVolume = useCallback((v: number) => {
    setVolumeState(Math.min(1, Math.max(0, v)))
  }, [])

  const toggleMute = useCallback(() => setPrefs({ muted: !mutedRef.current }), [])

  const next = useCallback(() => {
    setTrackIndex((i) => (i + 1) % DEFAULT_PLAYLIST.length)
  }, [])

  const prev = useCallback(() => {
    setTrackIndex((i) => (i - 1 + DEFAULT_PLAYLIST.length) % DEFAULT_PLAYLIST.length)
  }, [])

  const value = useMemo(
    (): ReelRadioContextValue => ({
      muted,
      volume,
      trackIndex,
      trackTitle: track?.title ?? '',
      armed,
      setVolume,
      toggleMute,
      next,
      prev,
    }),
    [armed, muted, next, prev, setVolume, track?.title, trackIndex, volume],
  )

  return <ReelRadioContext.Provider value={value}>{children}</ReelRadioContext.Provider>
}

export function ReelRadioHud() {
  const { trackTitle, muted, next, prev, toggleMute } = useReelRadio()
  return (
    <div
      data-testid="reel-radio-hud"
      className="pointer-events-auto fixed bottom-5 left-4 z-[170] flex items-center gap-2 border border-[#f3e6d2]/20 bg-[#040302]/70 px-3 py-1.5 text-[11px] uppercase tracking-[0.08em] text-[#f3e6d2] backdrop-blur-sm"
      aria-live="polite"
    >
      <span className="max-w-[10rem] truncate text-[#c4b39c]">{muted ? '静音' : trackTitle}</span>
      <button type="button" className="px-1 text-[#c4b39c] hover:text-[#f3e6d2]" aria-label="上一曲" onClick={prev}>
        ‹
      </button>
      <button type="button" className="px-1 text-[#c4b39c] hover:text-[#f3e6d2]" aria-label="下一曲" onClick={next}>
        ›
      </button>
      <button
        type="button"
        className="px-1 text-[#c4b39c] hover:text-[#f3e6d2]"
        aria-label={muted ? '取消静音' : '静音'}
        onClick={toggleMute}
      >
        {muted ? 'MUTE' : 'ON'}
      </button>
    </div>
  )
}
