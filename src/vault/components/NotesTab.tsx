import { useState } from 'react'
import Markdown, { type Components } from 'react-markdown'
import type { NoteEntry } from '../types'
import { useBlobText, type ReadBlob } from '../useBlob'

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

export function NotesTab({ notes, read }: { notes: NoteEntry[]; read: ReadBlob }) {
  if (notes.length === 0) return <p className="py-10 text-center text-sm text-muted">还没有笔记</p>
  return (
    <ul className="space-y-3">
      {notes.map((note) => (
        <NoteCard key={note.blob} note={note} read={read} />
      ))}
    </ul>
  )
}
