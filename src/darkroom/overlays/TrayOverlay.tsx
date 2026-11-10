import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { copy } from '../../config/copy'
import { processVaultPhoto } from '../../vault/photoProcess'
import { editBlockedMessage, failureMessage, gateOf } from '../mutateCopy'
import { useDarkroomVault } from '../VaultBridge'
import { EditNotice } from './EditNotice'

export function TrayOverlay({ onClose, onNeedGate }: { onClose: () => void; onNeedGate?: () => void }) {
  const vault = useDarkroomVault()
  const { addPhoto } = vault
  const gate = gateOf(vault)
  const blocked = editBlockedMessage(gate)
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState('')
  const [developing, setDeveloping] = useState(false)
  const [fading, setFading] = useState(true)

  useEffect(() => {
    if (!developing) return
    const id = requestAnimationFrame(() => setFading(false))
    return () => cancelAnimationFrame(id)
  }, [developing])

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (blocked) {
      setStatus(blocked)
      return
    }
    setStatus('显影中…')
    try {
      const processed = await processVaultPhoto(file)
      const result = await addPhoto({ caption: '', ...processed })
      if (!result.ok) {
        setStatus(failureMessage(result, gate))
        return
      }
      setFading(true)
      setDeveloping(true)
      setStatus('已显影')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '这张照片打不开')
    }
  }

  return (
    <section data-testid="tray-overlay" role="dialog" aria-label="显影盘" className="dr-panel absolute inset-x-3 bottom-3 z-10 p-3 text-xs sm:inset-x-8 sm:bottom-8">
      <input ref={inputRef} data-testid="tray-file" type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => void pick(e)} />
      <EditNotice message={blocked} gate={gate} onNeedGate={onNeedGate} />
      <div className="flex items-center gap-3">
        <button type="button" disabled={blocked !== null} onClick={() => inputRef.current?.click()} className="dr-btn px-3 py-2">
          选照片
        </button>
        <span role="status" className="min-w-0 flex-1">{status}</span>
        <button type="button" onClick={onClose} className="dr-btn px-3 py-2">
          {copy.darkroom.back}
        </button>
      </div>
      {developing && (
        <div
          data-testid="develop-plane"
          className="mx-auto mt-3 h-24 w-32 bg-[#ddd] transition-all duration-1000"
          style={{ opacity: fading ? 0 : 1, transform: fading ? 'scale(0.8)' : 'scale(1)' }}
        />
      )}
    </section>
  )
}
