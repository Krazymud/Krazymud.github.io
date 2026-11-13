import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { copy } from '../../config/copy'
import { DR_COLORS, DR_FONTS } from '../../darkroom/theme'

export const HOLD_MS = 1000

interface UnlockPanelProps {
  canRemember: boolean
  onUnlock: (passphrase: string, remember: boolean) => Promise<boolean>
}

const PLACEHOLDER_TONES = ['#2a2420', '#1c1a18', '#32302c', '#242220']

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
      className={`dr-stage relative min-h-dvh overflow-hidden ${shaking ? 'motion-safe:animate-vault-shake' : ''}`}
      style={{ background: DR_COLORS.ink, color: DR_COLORS.cream }}
    >
      <div className="dr-proj">
        <div className="dr-proj-spill" aria-hidden />
        <div className="dr-proj-frame">
          <div className="dr-opening-beam" aria-hidden />
          <div className="dr-opening-shadow" aria-hidden />
          <div className="dr-opening-zap z1" aria-hidden />
          <div className="dr-opening-zap z2" aria-hidden />
          <div className="dr-opening-weave" aria-hidden />
          <div className="dr-opening-mottle" aria-hidden />
          <div className="dr-opening-specks" aria-hidden />
          <div className="dr-opening-grain" aria-hidden />
          <div className="dr-opening-vig" aria-hidden />

          <aside className="dr-opening-log mono" aria-hidden>
            <p>
              DARKROOM V.01 — {copy.siteName.toUpperCase()}
              <br />
              400 · 24 EXP · REEL 1
              <br />
              <br />
              THREADING FILM ........... OK
              <br />
              WARMING THE LAMP .......... OK
              <br />
              AWAITING KEY .............. ··
            </p>
          </aside>

          <div className="dr-opening-title">
            <h1 style={{ fontFamily: DR_FONTS.display }}>{copy.siteName}</h1>
            <p className="sub" style={{ fontFamily: DR_FONTS.display }}>
              {copy.darkroom.tagline}
            </p>
          </div>

          <div className="absolute left-1/2 top-[52%] z-[5] w-[min(18rem,70%)] -translate-x-1/2 text-center">
            <label className="block text-left text-[10px] tracking-[0.2em] opacity-70">
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
          </div>

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
            className="dr-opening-mark relative touch-none select-none disabled:opacity-60"
            style={{ fontFamily: DR_FONTS.hand, color: DR_COLORS.accent, top: '72%' }}
          >
            <span className="relative z-10">{busy ? copy.darkroom.unsealing : copy.darkroom.openingCtaHand}</span>
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
          <p className="absolute bottom-[14%] left-0 right-0 z-[5] text-center text-[10px] tracking-[0.18em] opacity-50">
            {reduced ? copy.darkroom.tapHint : copy.darkroom.holdHint}
          </p>
          {message && (
            <p role="alert" className="absolute bottom-[9%] left-0 right-0 z-[5] text-center text-sm" style={{ color: DR_COLORS.accent }}>
              {message}
            </p>
          )}

          <aside data-testid="unlock-belt" className="dr-opening-strip" aria-hidden>
            <div className="dr-opening-belt">
              {[...PLACEHOLDER_TONES, ...PLACEHOLDER_TONES].map((bg, i) => (
                <div key={i} className="dr-opening-fr">
                  <div className="img" style={{ background: bg }} />
                </div>
              ))}
            </div>
          </aside>

          <p className="dr-opening-corner bl mono">
            SINCE
            <br />
            DARKROOM
          </p>
          <p className="dr-opening-corner br mono">
            RUNNING TIME
            <br />
            AWAITING KEY
          </p>
        </div>
      </div>
    </form>
  )
}
