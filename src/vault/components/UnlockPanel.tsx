import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { copy } from '../../config/copy'
import { DR_COLORS, DR_FONTS } from '../../darkroom/theme'

export const HOLD_MS = 1000

interface UnlockPanelProps {
  canRemember: boolean
  onUnlock: (passphrase: string, remember: boolean) => Promise<boolean>
}

const PLACEHOLDER_FRAMES = [
  'linear-gradient(145deg,#2a221c,#15100c 55%,#3a2a22)',
  'linear-gradient(160deg,#1c2420,#0e1210 50%,#2a3228)',
  'linear-gradient(135deg,#242028,#100e14 60%,#32282e)',
]

export function UnlockPanel({ canRemember, onUnlock }: UnlockPanelProps) {
  const reduced = useReducedMotion() ?? false
  const [passphrase, setPassphrase] = useState('')
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [holding, setHolding] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current)
    },
    [],
  )

  async function submit() {
    if (busy) return
    if (passphrase.trim() === '') {
      setMessage('先输入口令')
      return
    }
    setBusy(true)
    setMessage(null)
    let ok: boolean
    try {
      ok = await onUnlock(passphrase, remember && canRemember)
    } catch {
      setBusy(false)
      setMessage('出了点问题，请再试一次')
      return
    }
    if (ok) return
    setBusy(false)
    setMessage('口令不对')
    setShaking(true)
  }

  function startHold() {
    if (busy || reduced) return
    if (holdTimer.current) clearTimeout(holdTimer.current)
    setHolding(true)
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null
      setHolding(false)
      void submit()
    }, HOLD_MS)
  }

  function cancelHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    holdTimer.current = null
    setHolding(false)
  }

  return (
    <form
      data-testid="unlock-panel"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
      onAnimationEnd={() => setShaking(false)}
      className={`dr-opening relative flex min-h-dvh w-full items-center justify-center overflow-hidden px-4 py-10 ${shaking ? 'motion-safe:animate-vault-shake' : ''}`}
      style={{ background: DR_COLORS.bg, color: DR_COLORS.cream }}
    >
      <div className="dr-opening-bokeh" aria-hidden />
      <div className="dr-opening-specks" aria-hidden />
      <div className="dr-vig absolute inset-0 z-[2]" aria-hidden />

      <aside
        className="pointer-events-none absolute left-4 top-6 z-10 hidden max-w-[14rem] text-left text-[10px] leading-relaxed tracking-[0.14em] opacity-70 sm:block"
        style={{ fontFamily: DR_FONTS.mono }}
        aria-hidden
      >
        <p>DARKROOM V.01 — {copy.siteName.toUpperCase()}</p>
        <p>400 · 24 EXP · REEL 1</p>
        <p className="mt-3">THREADING FILM ........... OK</p>
        <p>WARMING THE LAMP .......... OK</p>
        <p>AWAITING KEY .............. ··</p>
      </aside>

      <div className="relative z-10 flex w-full max-w-4xl items-center justify-center gap-8 sm:gap-12">
        <div className="flex max-w-md flex-1 flex-col items-center gap-5 text-center">
          <h1
            className="text-5xl font-normal tracking-[0.08em] sm:text-6xl"
            style={{ fontFamily: DR_FONTS.display, color: DR_COLORS.cream }}
          >
            {copy.siteName}
          </h1>
          <p
            className="text-sm italic tracking-[0.06em] opacity-80 sm:text-base"
            style={{ fontFamily: DR_FONTS.display }}
          >
            {copy.darkroom.tagline}
          </p>

          <label className="mt-2 w-full max-w-xs text-left text-[10px] tracking-[0.2em] opacity-70">
            {copy.darkroom.passphraseLabel}
            <input
              type="password"
              autoComplete="off"
              value={passphrase}
              disabled={busy}
              onChange={(event) => {
                setPassphrase(event.target.value)
                setMessage(null)
              }}
              className="mt-2 block w-full border-0 border-b bg-transparent px-0 py-2 text-base outline-none"
              style={{
                borderColor: 'rgba(243,230,210,0.35)',
                color: DR_COLORS.cream,
                fontFamily: DR_FONTS.mono,
              }}
            />
          </label>

          {canRemember && (
            <label className="flex items-center gap-2 text-xs opacity-70">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                className="accent-[#ee5546]"
              />
              在这台设备上记住
            </label>
          )}

          <button
            type="button"
            disabled={busy}
            aria-label={copy.darkroom.unseal}
            onPointerDown={startHold}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            onPointerCancel={cancelHold}
            onClick={reduced ? () => void submit() : undefined}
            onContextMenu={(event) => event.preventDefault()}
            className="relative mt-2 touch-none select-none px-2 py-1 text-3xl transition-opacity hover:opacity-90 disabled:opacity-60 sm:text-4xl"
            style={{ fontFamily: DR_FONTS.hand, color: DR_COLORS.accent }}
          >
            <span className="relative z-10">
              {busy ? copy.darkroom.unsealing : copy.darkroom.openingCtaHand}
            </span>
            {!reduced && (
              <motion.span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-[2px] origin-left"
                style={{ background: DR_COLORS.accent }}
                initial={false}
                animate={{ scaleX: holding ? 1 : 0 }}
                transition={{ duration: holding ? HOLD_MS / 1000 : 0.2, ease: 'linear' }}
              />
            )}
          </button>
          <p className="text-[10px] tracking-[0.18em] opacity-50">
            {reduced ? copy.darkroom.tapHint : copy.darkroom.holdHint}
          </p>

          {message && (
            <p role="alert" className="text-sm" style={{ color: DR_COLORS.accent }}>
              {message}
            </p>
          )}
        </div>

        <aside data-testid="unlock-belt" className="dr-film-belt hidden shrink-0 sm:flex" aria-hidden>
          {PLACEHOLDER_FRAMES.map((bg, i) => (
            <div key={i} className="dr-film-frame">
              <div className="dr-film-frame-inner" style={{ background: bg }} />
            </div>
          ))}
        </aside>
      </div>

      <p
        className="absolute bottom-5 left-5 z-10 text-[10px] tracking-[0.2em] opacity-50"
        style={{ fontFamily: DR_FONTS.mono }}
      >
        SINCE
        <br />
        DARKROOM
      </p>
      <p
        className="absolute bottom-5 right-5 z-10 text-right text-[10px] tracking-[0.2em] opacity-50"
        style={{ fontFamily: DR_FONTS.mono }}
      >
        RUNNING TIME
        <br />
        AWAITING KEY
      </p>
    </form>
  )
}
