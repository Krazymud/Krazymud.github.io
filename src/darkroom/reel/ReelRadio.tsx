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

export function ReelRadioProvider({ children }: { children: ReactNode }) {
  const [muted, setMuted] = useState(false)
  const [volume, setVolumeState] = useState(0.45)
  const [trackIndex, setTrackIndex] = useState(0)
  const [armed, setArmed] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fadeRef = useRef<number | null>(null)

  const track = DEFAULT_PLAYLIST[trackIndex % DEFAULT_PLAYLIST.length]

  const loadTrack = useCallback(
    (index: number, autoplay: boolean) => {
      const entry = DEFAULT_PLAYLIST[index % DEFAULT_PLAYLIST.length]
      if (!entry) return
      let audio = audioRef.current
      if (!audio) {
        audio = new Audio()
        audio.loop = false
        audioRef.current = audio
        audio.addEventListener('ended', () => {
          setTrackIndex((i) => (i + 1) % DEFAULT_PLAYLIST.length)
        })
      }
      audio.pause()
      audio.src = entry.src
      audio.muted = muted
      audio.volume = muted ? 0 : volume
      if (autoplay && armed) {
        void audio.play().catch(() => undefined)
      }
    },
    [armed, muted, volume],
  )

  useEffect(() => {
    loadTrack(trackIndex, true)
  }, [trackIndex, loadTrack])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = muted
    audio.volume = muted ? 0 : volume
  }, [muted, volume])

  useEffect(() => {
    if (armed) return
    const kick = () => {
      setArmed(true)
      const audio = audioRef.current
      if (!audio) {
        loadTrack(trackIndex, false)
      }
      const el = audioRef.current
      if (!el) return
      el.volume = 0
      el.muted = muted
      void el.play().catch(() => undefined)
      const start = performance.now()
      const tick = () => {
        const t = Math.min(1, (performance.now() - start) / FADE_MS)
        if (!muted) el.volume = volume * t
        if (t < 1) fadeRef.current = requestAnimationFrame(tick)
      }
      fadeRef.current = requestAnimationFrame(tick)
    }
    window.addEventListener('pointerdown', kick, { once: true })
    return () => window.removeEventListener('pointerdown', kick)
  }, [armed, loadTrack, muted, trackIndex, volume])

  useEffect(() => {
    return () => {
      if (fadeRef.current) cancelAnimationFrame(fadeRef.current)
      audioRef.current?.pause()
    }
  }, [])

  const setVolume = useCallback((v: number) => {
    setVolumeState(Math.min(1, Math.max(0, v)))
  }, [])

  const toggleMute = useCallback(() => setMuted((m) => !m), [])

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
      className="pointer-events-auto fixed bottom-4 left-4 z-[180] flex items-center gap-2 rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-xs text-fg backdrop-blur-sm"
      aria-live="polite"
    >
      <span className="max-w-[10rem] truncate text-muted">{muted ? '静音' : trackTitle}</span>
      <button type="button" className="px-1 text-muted hover:text-fg" aria-label="上一曲" onClick={prev}>
        ‹
      </button>
      <button type="button" className="px-1 text-muted hover:text-fg" aria-label="下一曲" onClick={next}>
        ›
      </button>
      <button type="button" className="px-1 text-muted hover:text-fg" aria-label={muted ? '取消静音' : '静音'} onClick={toggleMute}>
        {muted ? '🔇' : '🔈'}
      </button>
    </div>
  )
}
