import { useState } from 'react'
import Markdown, { type Components } from 'react-markdown'
import type { NoteEntry } from '../types'
import { useBlobText, type ReadBlob } from '../useBlob'
import { isRealDate, type WebNote } from '../web'

const markdownComponents: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
}

function preview(markdown: string): string {
  return markdown.replace(/[#*_`>]/g, '').replace(/\s+/g, ' ').trim()
}

export function NoteCard({ note, read }: { note: NoteEntry; read: ReadBlob }) {
  const [open, setOpen] = useState(false)
  const body = useBlobText(note.blob, read)

  return (
    <li className="border border-line bg-panel/90">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="w-full px-4 py-3 text-left">
        <span className="block text-xs text-muted">{note.date}</span>
        <span className="mt-1 block font-bold">{note.title}</span>
        {!open && body.status === 'ready' && <span className="mt-1 line-clamp-2 block text-sm text-muted">{preview(body.text)}</span>}
        {body.status === 'failed' && <span className="mt-1 block text-sm text-muted">这篇笔记打不开</span>}
      </button>
      {open && body.status === 'ready' && (
        <div className="vault-markdown border-t border-line px-4 py-3 text-sm leading-relaxed">
          <Markdown components={markdownComponents}>{body.text}</Markdown>
        </div>
      )}
    </li>
  )
}

const secondaryButton = 'border border-line px-3 py-1 text-xs text-muted hover:text-fg disabled:opacity-40'
const commitButton = 'border border-accent-hi bg-accent/30 px-3 py-1 text-xs font-bold disabled:opacity-40'

function NoteForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: { title: string; date: string; body: string }
  onSave: (input: { title: string; date: string; body: string }) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initial.title)
  const [date, setDate] = useState(initial.date)
  const [body, setBody] = useState(initial.body)
  const [invalid, setInvalid] = useState<'title' | 'date' | null>(null)

  return (
    <form
      className="space-y-3 border border-line bg-panel/90 p-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (title.trim() === '') {
          setInvalid('title')
          return
        }
        if (!isRealDate(date)) {
          setInvalid('date')
          return
        }
        onSave({ title: title.trim(), date, body })
      }}
    >
      <label className="block text-xs text-muted">
        标题
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={invalid === 'title'}
          className="mt-1 w-full border border-line bg-bg px-3 py-2 text-sm text-fg"
        />
      </label>
      <label className="block text-xs text-muted">
        日期
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          aria-invalid={invalid === 'date'}
          className="mt-1 w-full border border-line bg-bg px-3 py-2 text-sm text-fg"
        />
      </label>
      <label className="block text-xs text-muted">
        正文
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="mt-1 w-full border border-line bg-bg px-3 py-2 text-sm text-fg"
        />
      </label>
      <div className="flex gap-2">
        <button type="submit" className={commitButton}>
          保存
        </button>
        <button type="button" onClick={onCancel} className={secondaryButton}>
          取消
        </button>
      </div>
    </form>
  )
}

function WebNoteCard({
  note,
  canEdit,
  formOpen,
  onEdit,
  onDelete,
}: {
  note: WebNote
  canEdit: boolean
  formOpen: boolean
  onEdit: (note: WebNote) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  return (
    <li className="border border-line bg-panel/90">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => {
            if (value) setConfirm(false)
            return !value
          })
        }}
        className="w-full px-4 py-3 text-left"
      >
        <span className="block text-xs text-muted">{note.date}</span>
        <span className="mt-1 block font-bold">{note.title}</span>
        {!open && <span className="mt-1 line-clamp-2 block text-sm text-muted">{preview(note.body)}</span>}
      </button>
      {open && (
        <div className="vault-markdown border-t border-line px-4 py-3 text-sm leading-relaxed">
          <Markdown components={markdownComponents}>{note.body}</Markdown>
        </div>
      )}
      <div className="flex gap-2 border-t border-line px-4 py-3">
        {confirm ? (
          <>
            <button type="button" onClick={() => onDelete(note.id)} className={commitButton}>
              确认删除
            </button>
            <button type="button" onClick={() => setConfirm(false)} className={secondaryButton}>
              取消
            </button>
          </>
        ) : (
          <>
            <button type="button" disabled={!canEdit || formOpen} onClick={() => onEdit(note)} className={secondaryButton}>
              编辑
            </button>
            <button type="button" disabled={!canEdit || formOpen} onClick={() => setConfirm(true)} className={secondaryButton}>
              删除
            </button>
          </>
        )}
      </div>
    </li>
  )
}

export function NotesTab({
  notes,
  read,
  webNotes = [],
  canEdit = false,
  formOpen = false,
  draft = null,
  onBeginCreate,
  onBeginEdit,
  onDelete,
  onSave,
  onCancel,
}: {
  notes: NoteEntry[]
  read: ReadBlob
  webNotes?: WebNote[]
  canEdit?: boolean
  formOpen?: boolean
  draft?: { id?: string; title: string; date: string; body: string } | null
  onBeginCreate?: () => void
  onBeginEdit?: (note: WebNote) => void
  onDelete?: (id: string) => void
  onSave?: (input: { title: string; date: string; body: string }) => void
  onCancel?: () => void
}) {
  const creating = draft !== null && draft.id === undefined
  return (
    <div className="space-y-3">
      {onBeginCreate && (
        <button type="button" disabled={!canEdit || formOpen} onClick={onBeginCreate} className={secondaryButton}>
          新笔记
        </button>
      )}
      {creating && <NoteForm key="new" initial={draft} onSave={onSave!} onCancel={onCancel!} />}
      {notes.length === 0 && webNotes.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">还没有笔记</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <NoteCard key={note.blob} note={note} read={read} />
          ))}
          {webNotes.map((note) =>
            draft?.id === note.id ? (
              <li key={note.id}>
                <NoteForm initial={draft} onSave={onSave!} onCancel={onCancel!} />
              </li>
            ) : (
              <WebNoteCard
                key={note.id}
                note={note}
                canEdit={canEdit}
                formOpen={formOpen}
                onEdit={onBeginEdit!}
                onDelete={onDelete!}
              />
            ),
          )}
        </ul>
      )}
    </div>
  )
}
