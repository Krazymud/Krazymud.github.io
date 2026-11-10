import { useMemo, useState } from 'react'
import type { PhotoEntry } from '../../vault/types'
import { useDarkroomVault } from '../VaultBridge'
import { FrameView } from './FrameView'
import { RollSelect } from './RollSelect'
import { useBlobUrl } from './useBlobUrl'

function Thumb({ photo, onPick }: { photo: PhotoEntry; onPick: () => void }) {
  const url = useBlobUrl(photo.thumb)
  return (
    <button type="button" data-testid="strip-frame" data-source={photo.source} onClick={onPick} className="h-16 w-20 shrink-0 border border-line bg-black/50">
      {url && <img src={url} alt={photo.caption || '照片'} className="h-full w-full object-cover" />}
    </button>
  )
}

export function FilmStrip({ photos, onPick }: { photos: PhotoEntry[]; onPick: (photo: PhotoEntry) => void }) {
  return (
    <div className="mt-3 flex gap-2 overflow-x-auto">
      {photos.map((p) => (
        <Thumb key={p.source} photo={p} onPick={() => onPick(p)} />
      ))}
    </div>
  )
}

export function FilmOverlay({ mode, onClose }: { mode: 'rolls' | 'lightbox'; onClose: () => void }) {
  const { rolls, photos } = useDarkroomVault()
  const [activeRollId, setActiveRollId] = useState<string | null>(null)
  const [frameSource, setFrameSource] = useState<string | null>(null)

  const stripPhotos = useMemo(() => {
    const roll = rolls.find((r) => r.id === activeRollId)
    if (!roll) return []
    const bySource = new Map(photos.map((p) => [p.source, p]))
    return roll.photoSources.flatMap((s) => bySource.get(s) ?? [])
  }, [rolls, photos, activeRollId])
  const frame = mode === 'lightbox' ? stripPhotos.find((p) => p.source === frameSource) ?? null : null

  return (
    <section data-testid="film-overlay" role="dialog" aria-label={mode === 'rolls' ? '胶片卷' : '灯箱'} className="absolute inset-x-8 bottom-8 z-10 bg-black/60 p-3">
      <div className="mb-2 flex items-start gap-2">
        <div className="flex-1">
          <RollSelect
            rolls={rolls}
            activeRollId={activeRollId}
            onSelect={(id) => {
              setActiveRollId(id)
              setFrameSource(null)
            }}
          />
        </div>
        <button type="button" onClick={onClose} className="border border-line px-3 py-1 text-xs text-muted">
          放回
        </button>
      </div>
      {activeRollId && <FilmStrip photos={stripPhotos} onPick={(p) => setFrameSource(p.source)} />}
      {frame && <FrameView photo={frame} onClose={() => setFrameSource(null)} />}
    </section>
  )
}
