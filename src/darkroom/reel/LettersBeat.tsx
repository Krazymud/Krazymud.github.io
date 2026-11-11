import { useEffect, useState } from 'react'
import { copy } from '../../config/copy'
import { DR_COLORS } from '../theme'
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
        className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-12"
        style={{ background: DR_COLORS.bg, color: DR_COLORS.cream }}
        aria-label="书信"
      >
        <p className="text-sm opacity-70" style={{ fontFamily: 'Fraunces, serif' }}>
          书信
        </p>
        <p className="max-w-md text-center text-sm opacity-70">{copy.darkroom.lettersEmptyInvite}</p>
        <button type="button" className="dr-letter-hint border px-6 py-2 text-sm" onClick={() => next()}>
          {copy.darkroom.reelSkip}
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
        className="dr-letter-paper relative max-w-lg p-6"
        style={{ color: DR_COLORS.ink }}
      >
        <span className="dr-letter-hint absolute right-3 top-2 -rotate-6 border px-2 text-base tracking-wide">
          {copy.darkroom.letterStampNote}
        </span>
        <h2 className="text-lg font-semibold">{note.title}</h2>
        {note.date ? <p className="mt-1 text-xs opacity-70">{note.date}</p> : null}
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{bodyLoading ? '…' : body || ' '}</p>
      </article>
      <button type="button" className="dr-letter-hint border px-6 py-2 text-sm" onClick={() => next()}>
        {copy.darkroom.reelContinue}
      </button>
    </section>
  )
}
