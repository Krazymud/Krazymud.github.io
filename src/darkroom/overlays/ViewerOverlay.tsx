import { useEffect, useMemo, useState } from 'react'
import { copy } from '../../config/copy'
import { useDarkroomVault } from '../VaultBridge'
import { FrameView } from './FrameView'

export function ViewerOverlay({ onClose }: { onClose: () => void }) {
  const { rolls, photos } = useDarkroomVault()
  const [index, setIndex] = useState(0)

  const ordered = useMemo(() => {
    const bySource = new Map(photos.map((p) => [p.source, p]))
    const seen = new Set<string>()
    const inRolls = rolls.flatMap((r) =>
      r.photoSources.flatMap((s) => {
        const photo = bySource.get(s)
        if (!photo || seen.has(s)) return []
        seen.add(s)
        return [photo]
      }),
    )
    return [...inRolls, ...photos.filter((p) => !seen.has(p.source))]
  }, [rolls, photos])

  const last = ordered.length - 1
  const at = Math.min(index, Math.max(0, last))
  const photo = ordered[at]

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      else if (event.key === 'ArrowRight') setIndex((i) => Math.min(last, i + 1))
      else if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [last, onClose])

  return (
    <section data-testid="viewer-overlay" role="dialog" aria-label="看片机" className="dr-panel absolute inset-x-3 bottom-3 z-10 p-3 text-xs sm:inset-x-8 sm:bottom-8">
      <div className="flex items-center gap-2">
        <button type="button" disabled={at <= 0} onClick={() => setIndex(at - 1)} className="dr-btn px-3 py-2">
          {copy.darkroom.prev}
        </button>
        <span data-testid="viewer-position" className="dr-muted flex-1 text-center">
          {photo ? `${at + 1} / ${ordered.length}` : copy.darkroom.viewerEmpty}
        </span>
        <button type="button" disabled={at >= last} onClick={() => setIndex(at + 1)} className="dr-btn px-3 py-2">
          {copy.darkroom.next}
        </button>
        <button type="button" onClick={onClose} className="dr-btn px-3 py-2">
          {copy.darkroom.back}
        </button>
      </div>
      {photo && <FrameView key={photo.source} photo={photo} onClose={onClose} />}
    </section>
  )
}
