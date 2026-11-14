import { useState } from 'react'
import { copy } from '../../config/copy'
import { DR_COLORS, DR_FONTS } from '../../darkroom/theme'

interface UnlockPanelProps {
  canRemember: boolean
  onUnlock: (passphrase: string, remember: boolean) => Promise<boolean>
}

export function UnlockPanel({ canRemember, onUnlock }: UnlockPanelProps) {
  const [passphrase, setPassphrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

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
      ok = await onUnlock(passphrase, canRemember)
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

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center px-6 pb-8" style={{ background: 'rgba(4,3,2,0.28)' }}>
      <form
        role="dialog"
        aria-labelledby="unlock-title"
        data-testid="unlock-panel"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
        onAnimationEnd={() => setShaking(false)}
        className={`w-full max-w-sm px-6 py-7 ${shaking ? 'motion-safe:animate-vault-shake' : ''}`}
        style={{
          background: 'rgba(18,12,9,0.94)',
          color: DR_COLORS.cream,
          border: '1px solid rgba(243,230,210,0.18)',
          boxShadow: '0 18px 50px rgba(0,0,0,0.45)',
        }}
      >
        <p id="unlock-title" className="text-center text-lg" style={{ fontFamily: DR_FONTS.display }}>
          请输入口令
        </p>
        <input
          type="password"
          aria-label={copy.darkroom.passphraseLabel}
          autoComplete="off"
          value={passphrase}
          disabled={busy}
          onChange={(event) => {
            setPassphrase(event.target.value)
            setMessage(null)
          }}
          className="mt-5 block w-full border-0 border-b bg-transparent px-0 py-2 text-base outline-none"
          style={{
            borderColor: 'rgba(243,230,210,0.35)',
            color: DR_COLORS.cream,
            fontFamily: DR_FONTS.mono,
          }}
        />
        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full py-2 text-lg disabled:opacity-60"
          style={{ fontFamily: DR_FONTS.hand, color: DR_COLORS.accent }}
        >
          {busy ? copy.darkroom.unsealing : '进入'}
        </button>
        {message && (
          <p role="alert" className="mt-3 text-center text-sm" style={{ color: DR_COLORS.accent }}>
            {message}
          </p>
        )}
      </form>
    </div>
  )
}
