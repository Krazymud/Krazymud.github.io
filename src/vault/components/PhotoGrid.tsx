import { useState } from 'react'
import type { PhotoEntry } from '../types'
import { useBlobUrl, type ReadBlob } from '../useBlob'
import { PhotoViewer } from './PhotoViewer'

interface MonthGroup {
  label: string
  items: { photo: PhotoEntry; index: number }[]
}

export function monthLabel(date: string): string {
  const [year, month] = date.split('-')
  return `${year} 年 ${Number(month)} 月`
}

function groupByMonth(photos: PhotoEntry[]): MonthGroup[] {
  const groups: MonthGroup[] = []
  photos.forEach((photo, index) => {
    const label = monthLabel(photo.date)
    const last = groups.at(-1)
    if (last?.label === label) last.items.push({ photo, index })
    else groups.push({ label, items: [{ photo, index }] })
  })
  return groups
}

function PhotoTile({ photo, read, onOpen }: { photo: PhotoEntry; read: ReadBlob; onOpen: () => void }) {
  const thumb = useBlobUrl(photo.thumb, read, 'image/webp')
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`查看照片 ${photo.caption || photo.date}`}
      className="block aspect-square w-full overflow-hidden border border-line bg-panel hover:border-accent-hi"
    >
      {thumb.status === 'ready' && <img src={thumb.url} alt="" className="h-full w-full object-cover" />}
      {thumb.status === 'failed' && <span className="flex h-full items-center justify-center text-xs text-muted">打不开</span>}
    </button>
  )
}

export function PhotoGrid({ photos, read }: { photos: PhotoEntry[]; read: ReadBlob }) {
  const [viewing, setViewing] = useState<number | null>(null)
  if (photos.length === 0) return <p className="py-10 text-center text-sm text-muted">还没有照片</p>

  return (
    <>
      {groupByMonth(photos).map((group) => (
        <section key={group.label} className="mb-5">
          <h3 className="mb-2 text-xs text-muted">{group.label}</h3>
          <ul className="grid grid-cols-3 gap-1">
            {group.items.map(({ photo, index }) => (
              <li key={photo.thumb}>
                <PhotoTile photo={photo} read={read} onOpen={() => setViewing(index)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {viewing !== null && (
        <PhotoViewer photos={photos} index={viewing} read={read} onIndex={setViewing} onClose={() => setViewing(null)} />
      )}
    </>
  )
}
