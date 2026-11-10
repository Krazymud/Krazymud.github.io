import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { processVaultPhoto } from '../../vault/photoProcess'
import { useDarkroomVault } from '../VaultBridge'

export function TrayOverlay({ onClose }: { onClose: () => void }) {
  const { addPhoto } = useDarkroomVault()
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState('')
  const [developing, setDeveloping] = useState(false)
  const [fading, setFading] = useState(true)

  useEffect(() => {
    inputRef.current?.click()
  }, [])

  useEffect(() => {
    if (!developing) return
    const id = requestAnimationFrame(() => setFading(false))
    return () => cancelAnimationFrame(id)
  }, [developing])

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setStatus('显影中…')
    try {
      const processed = await processVaultPhoto(file)
      const result = await addPhoto({ caption: '', ...processed })
      if (!result.ok) {
        setStatus(`保存失败：${result.reason}`)
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
    <section data-testid="tray-overlay" role="dialog" aria-label="显影盘" className="absolute inset-x-8 bottom-8 z-10 bg-black/60 p-3 text-xs text-fg">
      <input ref={inputRef} data-testid="tray-file" type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => void pick(e)} />
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => inputRef.current?.click()} className="border border-line px-3 py-1">
          选照片
        </button>
        <span role="status">{status}</span>
        <button type="button" onClick={onClose} className="ml-auto border border-line px-3 py-1 text-muted">
          放回
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
