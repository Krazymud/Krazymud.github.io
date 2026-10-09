import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { play } from '../../audio/sound'

export const HOLD_MS = 1000

interface UnlockPanelProps {
  canRemember: boolean
  onUnlock: (passphrase: string, remember: boolean) => Promise<boolean>
}

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
    void play('ignition')
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
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
      onAnimationEnd={() => setShaking(false)}
      className={`mt-6 border border-accent/60 bg-panel/80 px-5 py-8 text-center ${shaking ? 'motion-safe:animate-vault-shake' : ''}`}
    >
      <p className="font-display text-xs tracking-[0.35em] text-accent-hi">PRIVATE VAULT</p>
      <p className="mt-4 font-serif text-2xl italic">
        Only <span className="text-accent-hi">us</span>.
      </p>

      <label className="mt-8 block text-left text-xs text-muted">
        口令
        <input
          type="password"
          autoComplete="off"
          value={passphrase}
          disabled={busy}
          onChange={(event) => {
            setPassphrase(event.target.value)
            setMessage(null)
          }}
          className="mt-2 block w-full border border-line bg-ink px-3 py-3 text-base text-fg outline-none focus:border-accent-hi"
        />
      </label>
      {canRemember && (
        <label className="mt-3 flex items-center gap-2 text-left text-xs text-muted">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="accent-[var(--accent-hi)]"
          />
          在这台设备上记住
        </label>
      )}

      <button
        type="button"
        aria-label="一键启动"
        disabled={busy}
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        onClick={reduced ? () => void submit() : undefined}
        onContextMenu={(event) => event.preventDefault()}
        className="relative mx-auto mt-8 flex h-32 w-32 touch-none select-none items-center justify-center rounded-full border border-line bg-ink disabled:opacity-70"
      >
        <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90">
          <circle cx="60" cy="60" r="54" fill="none" stroke="var(--color-line)" strokeWidth="3" />
          <motion.circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="var(--accent-hi)"
            strokeWidth="3"
            initial={false}
            animate={{ pathLength: holding ? 1 : 0 }}
            transition={{ duration: holding ? HOLD_MS / 1000 : 0.2, ease: 'linear' }}
          />
        </svg>
        <span className="font-display text-sm tracking-[0.2em]">{busy ? '点火中…' : 'START'}</span>
      </button>
      <p className="mt-3 text-xs text-muted">{reduced ? '点一下启动' : '按住启动'}</p>

      {message && (
        <p role="alert" className="mt-4 text-sm text-accent-hi">
          {message}
        </p>
      )}
    </form>
  )
}
