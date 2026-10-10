import { useState } from 'react'
import type { Memory } from '../memory'
import type { PhotoEntry } from '../types'
import { useBlobUrl, type ReadBlob } from '../useBlob'
import { NoteCard } from './NotesTab'
import { PhotoViewer } from './PhotoViewer'

function heading(memory: Memory): string {
  return memory.kind === 'anniversary' ? `${memory.years} 年前的今天` : '今日一张'
}

function MemoryPhoto({ photo, read, onOpen }: { photo: PhotoEntry; read: ReadBlob; onOpen: () => void }) {
  const thumb = useBlobUrl(photo.thumb, read, 'image/webp')
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`打开回忆 ${photo.caption || photo.date}`}
      className="flex w-full items-center gap-3 text-left"
    >
      <span className="block h-20 w-20 shrink-0 overflow-hidden border border-line bg-ink">
        {thumb.status === 'ready' && <img src={thumb.url} alt="" className="h-full w-full object-cover" />}
        {thumb.status === 'failed' && <span className="flex h-full items-center justify-center text-xs text-muted">打不开</span>}
      </span>
      {photo.caption && <span className="text-sm">{photo.caption}</span>}
    </button>
  )
}

export function MemoryCard({ memory, photos, read }: { memory: Memory; photos: PhotoEntry[]; read: ReadBlob }) {
  const [viewing, setViewing] = useState<number | null>(null)
  const { item } = memory
  const date = item.type === 'photo' ? item.photo.date : item.note.date

  return (
    <section aria-label="今日回忆" className="mt-4 border border-accent/60 bg-panel/80 p-3">
      <p className="mb-2 text-xs text-accent-hi">{`${heading(memory)} · ${date}`}</p>
      {item.type === 'photo' ? (
        <MemoryPhoto photo={item.photo} read={read} onOpen={() => setViewing(item.index)} />
      ) : (
        <ul>
          <NoteCard note={item.note} read={read} />
        </ul>
      )}
      {viewing !== null && (
        <PhotoViewer photos={photos} index={viewing} read={read} onIndex={setViewing} onClose={() => setViewing(null)} />
      )}
    </section>
  )
}
