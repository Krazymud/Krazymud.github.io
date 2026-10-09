import { useCallback, useEffect, useRef } from 'react'
import type { PhotoEntry } from '../types'
import { useBlobUrl, type ReadBlob } from '../useBlob'

const SWIPE_PX = 50

interface PhotoViewerProps {
  photos: PhotoEntry[]
  index: number
  read: ReadBlob
  onIndex: (index: number) => void
  onClose: () => void
}

export function PhotoViewer({ photos, index, read, onIndex, onClose }: PhotoViewerProps) {
  const photo = photos[index]
  const full = useBlobUrl(photo.full, read, 'image/webp')
  const touchX = useRef<number | null>(null)

  const go = useCallback(
    (delta: number) => {
      const next = index + delta
      if (next >= 0 && next < photos.length) onIndex(next)
    },
    [index, photos.length, onIndex],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowLeft') go(-1)
      else if (event.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="照片"
      className="fixed inset-0 z-30 flex flex-col bg-ink/95"
      onTouchStart={(event) => {
        touchX.current = event.touches[0].clientX
      }}
      onTouchEnd={(event) => {
        if (touchX.current === null) return
        const dx = event.changedTouches[0].clientX - touchX.current
        touchX.current = null
        if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? 1 : -1)
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 text-xs text-muted">
        <span>
          {index + 1} / {photos.length}
        </span>
        <button type="button" onClick={onClose} className="px-2 py-1 hover:text-fg">
          关闭
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-2">
        {full.status === 'ready' && (
          <img src={full.url} alt={photo.caption || photo.date} className="max-h-full max-w-full object-contain" />
        )}
        {full.status === 'loading' && <p className="text-sm text-muted">正在解密…</p>}
        {full.status === 'failed' && <p className="text-sm text-muted">这张照片打不开</p>}
      </div>
      <div className="px-4 py-4 text-center">
        {photo.caption && <p className="text-sm">{photo.caption}</p>}
        <p className="mt-1 text-xs text-muted">{photo.date}</p>
        <div className="mt-3 flex justify-center gap-6 text-sm">
          <button type="button" onClick={() => go(-1)} disabled={index === 0} className="disabled:opacity-30">
            上一张
          </button>
          <button type="button" onClick={() => go(1)} disabled={index === photos.length - 1} className="disabled:opacity-30">
            下一张
          </button>
        </div>
      </div>
    </div>
  )
}
