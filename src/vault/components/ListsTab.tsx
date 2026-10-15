import { useState } from 'react'
import type { ListContent, ListEntry, ListItem } from '../types'
import { useBlobText, type ReadBlob } from '../useBlob'

export interface ListDraft {
  source?: string
  title: string
  items: ListItem[]
}

const secondaryButton = 'border border-line px-3 py-1 text-xs text-muted hover:text-fg disabled:opacity-40'
const commitButton = 'border border-accent-hi bg-accent/30 px-3 py-1 text-xs font-bold disabled:opacity-40'

function parseContent(text: string): ListContent | null {
  try {
    const value = JSON.parse(text) as ListContent
    return Array.isArray(value.items) ? value : null
  } catch {
    return null
  }
}

function ListCard({
  list,
  read,
  canEdit,
  formOpen,
  onToggle,
  onEdit,
  onDelete,
}: {
  list: ListEntry
  read: ReadBlob
  canEdit: boolean
  formOpen: boolean
  onToggle?: (source: string, index: number, done: boolean) => void
  onEdit?: (list: ListEntry, items: ListItem[]) => void
  onDelete?: (source: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
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
        onClick={() => {
          setOpen((value) => {
            if (value) setConfirm(false)
            return !value
          })
        }}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="font-bold">{list.title}</span>
        <span className="shrink-0 text-xs text-muted">
          {content ? `已完成 ${done} / ${content.items.length}` : broken ? '这个清单打不开' : '…'}
        </span>
      </button>
      {open && content && (
        <ul className="space-y-2 border-t border-line px-4 py-3 text-sm">
          {content.items.map((item, index) => (
            <li key={index}>
              <button
                type="button"
                aria-pressed={item.done}
                disabled={!canEdit || !onToggle}
                onClick={() => onToggle?.(list.source, index, !item.done)}
                className="flex gap-2 text-left disabled:opacity-40"
              >
                <span aria-hidden className={item.done ? 'text-accent-hi' : 'text-muted'}>
                  {item.done ? '✓' : '○'}
                </span>
                <span className="sr-only">{item.done ? '已完成：' : '未完成：'}</span>
                <span className={item.done ? 'text-muted line-through' : ''}>{item.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {canEdit && onEdit && onDelete && (
        <div className="flex gap-2 border-t border-line px-4 py-3">
          {confirm ? (
            <>
              <button
                type="button"
                disabled={formOpen}
                onClick={() => {
                  if (formOpen) return
                  setConfirm(false)
                  onDelete(list.source)
                }}
                className={commitButton}
              >
                确认删除
              </button>
              <button type="button" onClick={() => setConfirm(false)} className={secondaryButton}>
                取消
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={formOpen || content === null}
                onClick={() => content && onEdit(list, content.items)}
                className={secondaryButton}
              >
                编辑
              </button>
              <button type="button" disabled={formOpen} onClick={() => setConfirm(true)} className={secondaryButton}>
                删除
              </button>
            </>
          )}
        </div>
      )}
    </li>
  )
}

function ListForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: ListDraft
  onSave: (input: ListDraft) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initial.title)
  const [invalid, setInvalid] = useState(false)
  const [rows, setRows] = useState(() =>
    initial.items.map((item) => ({ key: crypto.randomUUID(), ...item })),
  )

  return (
    <form
      className="space-y-3 border border-line bg-panel/90 p-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (title.trim() === '') {
          setInvalid(true)
          return
        }
        onSave({
          ...(initial.source ? { source: initial.source } : {}),
          title: title.trim(),
          items: rows.map((row) => ({ text: row.text.trim(), done: row.done })).filter((row) => row.text !== ''),
        })
      }}
    >
      <label className="block text-xs text-muted">
        标题
        <input
          value={title}
          aria-invalid={invalid}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-1 w-full border border-line bg-bg px-3 py-2 text-sm text-fg"
        />
      </label>
      {rows.map((row, index) => (
        <div key={row.key} className="flex gap-2">
          <input
            aria-label={`条目 ${index + 1}`}
            value={row.text}
            onChange={(event) =>
              setRows((current) => current.map((item) => (item.key === row.key ? { ...item, text: event.target.value } : item)))
            }
            className="min-w-0 flex-1 border border-line bg-bg px-3 py-2 text-sm text-fg"
          />
          <button type="button" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))} className={secondaryButton}>
            删除
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((current) => [...current, { key: crypto.randomUUID(), text: '', done: false }])}
        className={secondaryButton}
      >
        加一条
      </button>
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

export function ListsTab({
  lists,
  read,
  canEdit = false,
  formOpen = false,
  draft = null,
  onBeginCreate,
  onBeginEdit,
  onDelete,
  onSave,
  onCancel,
  onToggle,
}: {
  lists: ListEntry[]
  read: ReadBlob
  canEdit?: boolean
  formOpen?: boolean
  draft?: ListDraft | null
  onBeginCreate?: () => void
  onBeginEdit?: (list: ListEntry, items: ListItem[]) => void
  onDelete?: (source: string) => void
  onSave?: (input: ListDraft) => void
  onCancel?: () => void
  onToggle?: (source: string, index: number, done: boolean) => void
}) {
  const creating = draft !== null && draft.source === undefined
  return (
    <div className="space-y-3">
      {onBeginCreate && (
        <button type="button" disabled={!canEdit || formOpen} onClick={onBeginCreate} className={secondaryButton}>
          新清单
        </button>
      )}
      {creating && <ListForm key="new" initial={draft} onSave={onSave!} onCancel={onCancel!} />}
      {lists.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">还没有清单</p>
      ) : (
        <ul className="space-y-3">
          {lists.map((list) =>
            draft?.source === list.source ? (
              <li key={list.source}>
                <ListForm initial={draft} onSave={onSave!} onCancel={onCancel!} />
              </li>
            ) : (
              <ListCard
                key={`${list.source}:${list.blob}`}
                list={list}
                read={read}
                canEdit={canEdit}
                formOpen={formOpen}
                onToggle={onToggle}
                onEdit={onBeginEdit}
                onDelete={onDelete}
              />
            ),
          )}
        </ul>
      )}
    </div>
  )
}
