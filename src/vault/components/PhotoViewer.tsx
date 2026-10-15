import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PhotoEntry } from '../types'
import { useBlobUrl, type ReadBlob } from '../useBlob'
import { applyPan, applyPinch, resetZoom, type ZoomState } from './photoZoom'

const SWIPE_PX = 50
const ZOOM_SWIPE_MAX_SCALE = 1.02

function pointerDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

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
  const [zoom, setZoom] = useState<ZoomState>(resetZoom)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchStartDist = useRef(0)
  const pinchStartScale = useRef(1)
  const swipeStartX = useRef<number | null>(null)

  const go = useCallback(
    (delta: number) => {
      const next = index + delta
      if (next >= 0 && next < photos.length) onIndex(next)
    },
    [index, photos.length, onIndex],
  )

  useEffect(() => {
    setZoom(resetZoom())
  }, [index])

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowLeft') go(-1)
      else if (event.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, onClose])

  const beginPinchIfNeeded = useCallback(() => {
    if (pointers.current.size !== 2) return
    const pts = [...pointers.current.values()]
    pinchStartDist.current = pointerDistance(pts[0], pts[1])
    pinchStartScale.current = zoomRef.current.scale
  }, [])

  const onImagePointerDown = (event: React.PointerEvent<HTMLImageElement>) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    event.currentTarget.setPointerCapture(event.pointerId)
    if (pointers.current.size === 2) {
      beginPinchIfNeeded()
    } else if (pointers.current.size === 1 && zoomRef.current.scale <= ZOOM_SWIPE_MAX_SCALE) {
      swipeStartX.current = event.clientX
    }
  }

  const onImagePointerMove = (event: React.PointerEvent<HTMLImageElement>) => {
    const prev = pointers.current.get(event.pointerId)
    if (!prev) return
    const dx = event.clientX - prev.x
    const dy = event.clientY - prev.y
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()]
      const dist = pointerDistance(pts[0], pts[1])
      setZoom((z) => applyPinch(z, pinchStartDist.current, dist, pinchStartScale.current))
    } else if (pointers.current.size === 1) {
      setZoom((z) => (z.scale > ZOOM_SWIPE_MAX_SCALE ? applyPan(z, dx, dy) : z))
    }
  }

  const onImagePointerUp = (event: React.PointerEvent<HTMLImageElement>) => {
    pointers.current.delete(event.pointerId)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (pointers.current.size === 1) {
      swipeStartX.current = null
    }

    if (pointers.current.size === 0 && swipeStartX.current !== null) {
      const dx = event.clientX - swipeStartX.current
      swipeStartX.current = null
      if (zoomRef.current.scale <= ZOOM_SWIPE_MAX_SCALE && Math.abs(dx) > SWIPE_PX) go(dx < 0 ? 1 : -1)
    } else if (pointers.current.size === 0) {
      swipeStartX.current = null
    }

    if (pointers.current.size === 2) {
      beginPinchIfNeeded()
    }
  }

  const onImageDoubleClick = () => {
    setZoom(resetZoom())
  }

  const stopBubble = (event: React.MouseEvent) => {
    event.stopPropagation()
  }

  const ui = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="照片"
      className="fixed inset-0 z-50 flex flex-col bg-ink/95"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      onClick={onClose}
    >
      <div className="flex shrink-0 items-center justify-between bg-ink/70 px-4 py-3 text-sm text-muted">
        <span>
          {index + 1} / {photos.length}
        </span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onClose()
          }}
          className="min-h-11 min-w-11 px-3 hover:text-fg"
        >
          关闭
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 touch-none">
        {full.status === 'ready' && (
          <img
            src={full.url}
            alt={photo.caption || photo.date}
            className="max-h-full max-w-full object-contain"
            style={{
              transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
              transformOrigin: 'center center',
            }}
            onClick={stopBubble}
            onPointerDown={onImagePointerDown}
            onPointerMove={onImagePointerMove}
            onPointerUp={onImagePointerUp}
            onPointerCancel={onImagePointerUp}
            onDoubleClick={onImageDoubleClick}
          />
        )}
        {full.status === 'loading' && <p className="text-sm text-muted">正在解密…</p>}
        {full.status === 'failed' && <p className="text-sm text-muted">这张照片打不开</p>}
      </div>
      <div className="shrink-0 bg-ink/70 px-4 py-3 text-center">
        {photo.caption && <p className="text-sm text-fg">{photo.caption}</p>}
        <p className="mt-1 text-xs text-muted">{photo.date}</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={(event) => {
              stopBubble(event)
              go(-1)
            }}
            disabled={index === 0}
            className="min-h-11 border border-line disabled:opacity-30"
          >
            上一张
          </button>
          <button
            type="button"
            onClick={(event) => {
              stopBubble(event)
              go(1)
            }}
            disabled={index === photos.length - 1}
            className="min-h-11 border border-line disabled:opacity-30"
          >
            下一张
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(ui, document.body)
}
