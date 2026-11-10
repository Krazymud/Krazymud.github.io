import { useCallback, useState } from 'react'
import type { PhotoEntry } from '../../vault/types'
import { useDarkroomVault } from '../VaultBridge'
import { usePolaroidTakeHome, type PolaroidWallFrame } from './PolaroidTakeHome'
import { useReel } from './ReelStage'

const WALL_LIMIT = 8

export function TrayWallBeat() {
  const { next } = useReel()
  const { photos, readBlob } = useDarkroomVault()
  const { open: openPolaroid } = usePolaroidTakeHome()
  const [loadingPolaroid, setLoadingPolaroid] = useState(false)

  const wallPhotos = photos.slice(0, WALL_LIMIT)
  const hasPhotos = wallPhotos.length > 0

  const loadWallFrames = useCallback(async (): Promise<PolaroidWallFrame[]> => {
    const frames: PolaroidWallFrame[] = []
    const urls: string[] = []
    try {
      for (let i = 0; i < wallPhotos.length; i++) {
        const p = wallPhotos[i]
        const bytes = await readBlob(p.thumb)
        if (!bytes?.length) continue
        const blob = new Blob([bytes], { type: 'image/jpeg' })
        const previewUrl = URL.createObjectURL(blob)
        urls.push(previewUrl)
        frames.push({
          previewUrl,
          caption: polaroidCaption(p),
          date: p.date || '',
          index: i,
        })
      }
      return frames
    } catch {
      urls.forEach((u) => URL.revokeObjectURL(u))
      return []
    }
  }, [readBlob, wallPhotos])

  const onTakeHome = async () => {
    if (!hasPhotos || loadingPolaroid) return
    setLoadingPolaroid(true)
    try {
      const frames = await loadWallFrames()
      if (frames.length) openPolaroid(frames)
    } finally {
      setLoadingPolaroid(false)
    }
  }

  return (
    <section
      data-testid="tray-wall-beat"
      className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-fg"
      aria-label="照片墙"
    >
      <p className="font-display text-lg tracking-widest">照片墙</p>
      <p className="text-xs text-muted">从显影盘中挑选，订上钉子。（至多 {WALL_LIMIT} 张用于拍立得带走）</p>
      <button
        type="button"
        className="border border-accent-hi px-6 py-2 text-sm disabled:opacity-40"
        disabled={!hasPhotos || loadingPolaroid}
        onClick={() => void onTakeHome()}
      >
        {loadingPolaroid ? '读取照片…' : '带走拍立得'}
      </button>
      <button
        type="button"
        className="border border-accent-hi px-6 py-2 text-sm"
        onClick={() => next()}
      >
        继续
      </button>
    </section>
  )
}

function polaroidCaption(photo: PhotoEntry): string {
  const cap = photo.caption?.trim()
  if (cap) return cap
  if (photo.date?.trim()) return photo.date.trim()
  return ''
}
