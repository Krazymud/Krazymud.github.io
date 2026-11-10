import { useMemo, useState } from 'react'
import type { PhotoEntry } from '../../vault/types'
import { useDarkroomVault } from '../VaultBridge'
import { FrameView } from './FrameView'
import { RollSelect } from './RollSelect'
import { useBlobUrl } from './useBlobUrl'

function Thumb({ photo, onPick }: { photo: PhotoEntry; onPick: () => void }) {
  const url = useBlobUrl(photo.thumb)
  return (
    <button type="button" data-testid="strip-frame" data-source={photo.source} onClick={onPick} className="dr-btn h-16 w-20 shrink-0 overflow-hidden p-0">
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

export function FilmOverlay({
  mode,
  onClose,
  activeRollId: activeRollIdProp,
  onActiveRollIdChange,
}: {
  mode: 'rolls' | 'lightbox'
  onClose: () => void
  activeRollId?: string | null
  onActiveRollIdChange?: (id: string | null) => void
}) {
  const { rolls, photos } = useDarkroomVault()
  const [activeRollIdLocal, setActiveRollIdLocal] = useState<string | null>(null)
  const activeRollId = activeRollIdProp !== undefined ? activeRollIdProp : activeRollIdLocal
  const setRoll = (id: string | null) => {
    if (onActiveRollIdChange) onActiveRollIdChange(id)
    else setActiveRollIdLocal(id)
  }
  const [frameSource, setFrameSource] = useState<string | null>(null)

  const stripPhotos = useMemo(() => {
    const roll = rolls.find((r) => r.id === activeRollId)
    if (!roll) return []
    const bySource = new Map(photos.map((p) => [p.source, p]))
    return roll.photoSources.flatMap((s) => bySource.get(s) ?? [])
  }, [rolls, photos, activeRollId])
  const frame = stripPhotos.find((p) => p.source === frameSource) ?? null

  return (
    <section data-testid="film-overlay" role="dialog" aria-label={mode === 'rolls' ? '胶片卷' : '灯箱'} className="dr-panel absolute inset-x-3 bottom-3 z-10 p-3 sm:inset-x-8 sm:bottom-8">
      <div className="mb-2 flex items-start gap-2">
        <div className="flex-1">
          <RollSelect
            rolls={rolls}
            activeRollId={activeRollId}
            onSelect={(id) => {
              setRoll(id)
              setFrameSource(null)
            }}
          />
        </div>
        <button type="button" onClick={onClose} className="dr-btn px-3 py-2 text-xs">
          放回
        </button>
      </div>
      {activeRollId && <FilmStrip photos={stripPhotos} onPick={(p) => setFrameSource(p.source)} />}
      {activeRollId && !frame && stripPhotos.length > 0 && <p className="dr-muted mt-2 text-xs">点帧看大图</p>}
      {frame && <FrameView photo={frame} onClose={() => setFrameSource(null)} />}
    </section>
  )
}
