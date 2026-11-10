import { useEffect, useState } from 'react'
import { useDarkroomVault } from '../VaultBridge'
import { useReel } from './ReelStage'

const decoder = new TextDecoder()

export function LettersBeat() {
  const { notes, readBlob } = useDarkroomVault()
  const { next } = useReel()
  const note = notes[0] ?? null
  const [body, setBody] = useState('')
  const [bodyLoading, setBodyLoading] = useState(false)

  useEffect(() => {
    if (!note) {
      setBody('')
      setBodyLoading(false)
      return
    }
    let alive = true
    setBodyLoading(true)
    readBlob(note.blob).then(
      (bytes) => {
        if (!alive) return
        setBody(decoder.decode(bytes))
        setBodyLoading(false)
      },
      () => {
        if (!alive) return
        setBody('')
        setBodyLoading(false)
      },
    )
    return () => {
      alive = false
    }
  }, [note, readBlob])

  if (!note) {
    return (
      <section
        data-testid="letters-beat"
        data-empty="true"
        className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-12 text-fg"
        aria-label="书信"
      >
        <p className="font-display text-sm text-muted">书信</p>
        <p className="max-w-md text-center text-sm text-muted">还没有信。你可以略过此幕，直接进入暗房桌面。</p>
        <button type="button" className="border border-accent-hi px-6 py-2 text-sm" onClick={() => next()}>
          略过
        </button>
      </section>
    )
  }

  return (
    <section
      data-testid="letters-beat"
      data-empty="false"
      className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-6 py-12"
      aria-label="书信"
    >
      <article
        data-testid="letters-card"
        className="relative max-w-lg bg-[#efe6cf] p-6 font-mono text-[#2a2218] shadow-lg"
      >
        <span className="absolute right-3 top-2 -rotate-6 border border-[#8a2a1f] px-2 text-[10px] tracking-widest text-[#8a2a1f]">
          来信
        </span>
        <h2 className="text-lg font-semibold">{note.title}</h2>
        {note.date ? <p className="mt-1 text-xs opacity-70">{note.date}</p> : null}
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{bodyLoading ? '…' : body || ' '}</p>
      </article>
      <button type="button" className="border border-accent-hi px-6 py-2 text-sm text-fg" onClick={() => next()}>
        继续
      </button>
    </section>
  )
}
