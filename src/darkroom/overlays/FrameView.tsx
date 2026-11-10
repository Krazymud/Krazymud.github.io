import type { PhotoEntry } from '../../vault/types'
import { useBlobUrl } from './useBlobUrl'

export function FrameView({ photo, onClose }: { photo: PhotoEntry; onClose: () => void }) {
  const url = useBlobUrl(photo.full)
  return (
    <figure data-testid="frame-view" className="mt-3 bg-black/70 p-2">
      {url ? <img src={url} alt={photo.caption || '照片'} className="max-h-[60vh] w-full object-contain" /> : <p className="text-xs text-muted">显影中…</p>}
      {photo.caption && <figcaption className="mt-1 text-xs text-fg">{photo.caption}</figcaption>}
      <button type="button" onClick={onClose} className="mt-1 border border-line px-3 py-1 text-xs text-muted">
        收起
      </button>
    </figure>
  )
}
