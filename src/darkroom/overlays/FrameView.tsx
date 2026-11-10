import type { PhotoEntry } from '../../vault/types'
import { useBlobUrl } from './useBlobUrl'

export function FrameView({ photo, onClose }: { photo: PhotoEntry; onClose: () => void }) {
  const url = useBlobUrl(photo.full)
  return (
    <figure data-testid="frame-view" className="dr-panel mt-3 p-2">
      {url ? <img src={url} alt={photo.caption || '照片'} className="max-h-[50vh] w-full object-contain" /> : <p className="dr-muted text-xs">显影中…</p>}
      {photo.caption && <figcaption className="mt-1 text-xs">{photo.caption}</figcaption>}
      <button type="button" onClick={onClose} className="dr-btn mt-2 px-3 py-2 text-xs">
        收起
      </button>
    </figure>
  )
}
