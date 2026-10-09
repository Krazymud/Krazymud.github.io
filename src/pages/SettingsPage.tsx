import { useState, type ChangeEvent } from 'react'
import { useProgress } from '../progress/ProgressProvider'
import { parseProgress, serializeProgress, type ProgressData } from '../progress/store'
import { studyDay } from '../trial/day'

export function SettingsPage() {
  const { data, update } = useProgress()
  const [pending, setPending] = useState<ProgressData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  function exportProgress() {
    const blob = new Blob([serializeProgress(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `midnight-garage-progress-${studyDay(new Date())}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    let text: string
    try {
      text = await file.text()
    } catch {
      setMessage(null)
      setPending(null)
      setError('无法读取文件')
      return
    }
    const result = parseProgress(text)
    setMessage(null)
    if (result.ok) {
      setPending(result.data)
      setError(null)
    } else {
      setPending(null)
      setError(result.reason)
    }
  }

  function confirmImport() {
    if (!pending) return
    update(() => pending)
    setPending(null)
    setMessage('进度已导入')
  }

  const learned = Object.keys(data.words).length

  return (
    <section className="space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-wide">设置</h1>

      <div className="border border-line bg-panel/90 p-4">
        <h2 className="text-sm font-bold">导出进度</h2>
        <p className="mt-1 text-xs text-muted">当前已学 {learned} 个单词。换设备前先导出，在新设备上导入。</p>
        <button type="button" onClick={exportProgress} className="mt-3 border border-accent-hi bg-accent/20 px-4 py-2 text-sm">
          导出进度文件
        </button>
      </div>

      <div className="border border-line bg-panel/90 p-4">
        <h2 className="text-sm font-bold">导入进度</h2>
        <label className="mt-3 block text-xs text-muted">
          导入进度文件
          <input type="file" accept="application/json,.json" onChange={onFile} className="mt-2 block w-full text-xs" />
        </label>
        {error && (
          <p role="alert" className="mt-3 text-sm text-accent-hi">
            {error}
          </p>
        )}
        {pending && (
          <div className="mt-3">
            <p className="text-sm">文件里有 {Object.keys(pending.words).length} 个已学单词，导入会覆盖当前进度。</p>
            <button type="button" onClick={confirmImport} className="mt-3 border border-accent-hi bg-accent/30 px-4 py-2 text-sm">
              确认导入
            </button>
          </div>
        )}
        {message && <p className="mt-3 text-sm">{message}</p>}
      </div>

      <p className="text-xs text-muted">
        词库来自{' '}
        <a href="https://github.com/skywind3000/ECDICT" className="underline">
          ECDICT
        </a>
        （MIT 协议）。
      </p>
    </section>
  )
}
