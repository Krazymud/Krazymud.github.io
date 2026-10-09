import { useState } from 'react'
import type { ListContent, ListEntry } from '../types'
import { useBlobText, type ReadBlob } from '../useBlob'

function parseContent(text: string): ListContent | null {
  try {
    const value = JSON.parse(text) as ListContent
    return Array.isArray(value.items) ? value : null
  } catch {
    return null
  }
}

function ListCard({ list, read }: { list: ListEntry; read: ReadBlob }) {
  const [open, setOpen] = useState(false)
  const body = useBlobText(list.blob, read)
  const content = body.status === 'ready' ? parseContent(body.text) : null
  const broken = body.status === 'failed' || (body.status === 'ready' && content === null)
  const done = content?.items.filter((item) => item.done).length ?? 0

  return (
    <li className="border border-line bg-panel/90">
      <button
        type="button"
        aria-expanded={open}
        disabled={content === null}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="font-bold">{list.title}</span>
        <span className="shrink-0 text-xs text-muted">
          {content ? `已完成 ${done} / ${content.items.length}` : broken ? '这个清单打不开' : '…'}
        </span>
      </button>
      {open && content && (
        <ul className="space-y-2 border-t border-line px-4 py-3 text-sm">
          {content.items.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className={item.done ? 'text-accent-hi' : 'text-muted'}>
                {item.done ? '✓' : '○'}
              </span>
              <span className="sr-only">{item.done ? '已完成：' : '未完成：'}</span>
              <span className={item.done ? 'text-muted line-through' : ''}>{item.text}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

export function ListsTab({ lists, read }: { lists: ListEntry[]; read: ReadBlob }) {
  if (lists.length === 0) return <p className="py-10 text-center text-sm text-muted">还没有清单</p>
  return (
    <ul className="space-y-3">
      {lists.map((list) => (
        <ListCard key={list.blob} list={list} read={read} />
      ))}
    </ul>
  )
}
