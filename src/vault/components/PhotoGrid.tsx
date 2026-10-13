import { useRef, useState } from 'react'
import { PhotoProcessError, processVaultPhoto } from '../photoProcess'
import type { PhotoEntry } from '../types'
import { useBlobUrl, type ReadBlob } from '../useBlob'
import { PhotoViewer } from './PhotoViewer'

type Processed = Awaited<ReturnType<typeof processVaultPhoto>>
export type PhotoAddInput = Processed & { caption: string }
type PhotoProcessor = (file: File) => Promise<Processed>

const smallButton = 'border border-line px-2 py-1 text-xs text-muted hover:text-fg disabled:opacity-40'

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

function PhotoDelete({ disabled, onDelete }: { disabled: boolean; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false)
  if (!confirm) {
    return (
      <button type="button" disabled={disabled} onClick={() => setConfirm(true)} className={smallButton}>
        删除
      </button>
    )
  }
  return (
    <span className="flex gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setConfirm(false)
          onDelete()
        }}
        className={`${smallButton} border-accent-hi text-fg`}
      >
        确认删除
      </button>
      <button type="button" onClick={() => setConfirm(false)} className={smallButton}>
        取消
      </button>
    </span>
  )
}

export function PhotoGrid({
  photos,
  read,
  canEdit = false,
  syncing = false,
  onAdd,
  onDelete,
  processPhoto = processVaultPhoto,
}: {
  photos: PhotoEntry[]
  read: ReadBlob
  canEdit?: boolean
  syncing?: boolean
  onAdd?: (input: PhotoAddInput) => Promise<boolean>
  onDelete?: (source: string) => void
  processPhoto?: PhotoProcessor
}) {
  const [viewing, setViewing] = useState<number | null>(null)
  const [pending, setPending] = useState<Processed | null>(null)
  const [caption, setCaption] = useState('')
  const [date, setDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const editable = canEdit && !syncing

  async function pick(file: File | undefined) {
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const processed = await processPhoto(file)
      setPending(processed)
      setDate(processed.date)
      setCaption('')
    } catch (cause) {
      setError(cause instanceof PhotoProcessError ? '这张照片打不开' : '这张照片没存上')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function confirmAdd() {
    if (!pending || !onAdd) return
    const ok = await onAdd({ ...pending, caption, date })
    if (ok) setPending(null)
    else setError('这张照片没存上')
  }

  const addControls = canEdit && onAdd && (
    <div className="mb-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        data-testid="photo-file-input"
        onChange={(event) => void pick(event.target.files?.[0])}
      />
      {pending ? (
        <form
          className="flex flex-col gap-2 border border-line bg-panel/90 p-3"
          onSubmit={(event) => {
            event.preventDefault()
            void confirmAdd()
          }}
        >
          <input
            aria-label="照片说明"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            className="border border-line bg-bg px-2 py-1 text-sm"
          />
          <input
            aria-label="照片日期"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="border border-line bg-bg px-2 py-1 text-sm"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={!editable} className={`${smallButton} border-accent-hi text-fg`}>
              存入
            </button>
            <button type="button" onClick={() => setPending(null)} className={smallButton}>
              取消
            </button>
          </div>
        </form>
      ) : (
        <button type="button" disabled={!editable || busy} onClick={() => fileRef.current?.click()} className={smallButton}>
          加照片
        </button>
      )}
      {error && <p className="mt-2 text-sm text-muted">{error}</p>}
    </div>
  )

  if (photos.length === 0) {
    return (
      <>
        {addControls}
        <p className="py-10 text-center text-sm text-muted">还没有照片</p>
      </>
    )
  }

  return (
    <>
      {addControls}
      {groupByMonth(photos).map((group) => (
        <section key={group.label} className="mb-5">
          <h3 className="mb-2 text-xs text-muted">{group.label}</h3>
          <ul className="grid grid-cols-3 gap-1">
            {group.items.map(({ photo, index }) => (
              <li key={photo.thumb}>
                <PhotoTile photo={photo} read={read} onOpen={() => setViewing(index)} />
                {canEdit && onDelete && (
                  <div className="mt-1">
                    <PhotoDelete disabled={!editable} onDelete={() => onDelete(photo.source)} />
                  </div>
                )}
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
