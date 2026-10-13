import { useState } from 'react'
import type { ListContent, ListEntry } from '../types'
import { useBlobText, type ReadBlob } from '../useBlob'
import type { WebList } from '../web'

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
  publishedDone,
  onTogglePublished,
}: {
  list: ListEntry
  read: ReadBlob
  canEdit: boolean
  publishedDone: (source: string, index: number, itemCount: number, fallback: boolean) => boolean
  onTogglePublished?: (source: string, index: number, done: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const body = useBlobText(list.blob, read)
  const content = body.status === 'ready' ? parseContent(body.text) : null
  const broken = body.status === 'failed' || (body.status === 'ready' && content === null)
  const flags = content?.items.map((item, index) => publishedDone(list.source, index, content.items.length, item.done)) ?? []
  const done = flags.filter(Boolean).length

  return (
    <li className="border border-line bg-panel/90">
      <button
        type="button"
        aria-expanded={open}
        disabled={content === null}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="font-bold">{list.title}</span>
        <span className="shrink-0 text-xs text-muted">
          {content ? `已完成 ${done} / ${content.items.length}` : broken ? '这个清单打不开' : '…'}
        </span>
      </button>
      {open && content && (
        <ul className="space-y-2 border-t border-line px-4 py-3 text-sm">
          {content.items.map((item, index) => {
            const checked = flags[index]
            return (
              <li key={index} className="flex gap-2">
                {onTogglePublished ? (
                  <button
                    type="button"
                    aria-pressed={checked}
                    disabled={!canEdit}
                    onClick={() => onTogglePublished(list.source, index, !checked)}
                    className="flex gap-2 text-left disabled:opacity-40"
                  >
                    <span aria-hidden className={checked ? 'text-accent-hi' : 'text-muted'}>
                      {checked ? '✓' : '○'}
                    </span>
                    <span className="sr-only">{checked ? '已完成：' : '未完成：'}</span>
                    <span className={checked ? 'text-muted line-through' : ''}>{item.text}</span>
                  </button>
                ) : (
                  <>
                    <span aria-hidden className={checked ? 'text-accent-hi' : 'text-muted'}>
                      {checked ? '✓' : '○'}
                    </span>
                    <span className="sr-only">{checked ? '已完成：' : '未完成：'}</span>
                    <span className={checked ? 'text-muted line-through' : ''}>{item.text}</span>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}

function ListForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: { title: string; items: { id?: string; text: string; done: boolean }[] }
  onSave: (input: { title: string; items: { id?: string; text: string; done: boolean }[] }) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initial.title)
  const [invalid, setInvalid] = useState(false)
  const [rows, setRows] = useState(() =>
    initial.items.map((item) => ({ key: item.id ?? crypto.randomUUID(), ...item })),
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
          title: title.trim(),
          items: rows
            .map((row) => ({ ...(row.id ? { id: row.id } : {}), text: row.text.trim(), done: row.done }))
            .filter((row) => row.text !== ''),
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

function WebListCard({
  list,
  canEdit,
  formOpen,
  onEdit,
  onDelete,
  onToggle,
}: {
  list: WebList
  canEdit: boolean
  formOpen: boolean
  onEdit: (list: WebList) => void
  onDelete: (id: string) => void
  onToggle?: (listId: string, itemId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const done = list.items.filter((item) => item.done).length
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
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="font-bold">{list.title}</span>
        <span className="shrink-0 text-xs text-muted">{`已完成 ${done} / ${list.items.length}`}</span>
      </button>
      {open && (
        <ul className="space-y-2 border-t border-line px-4 py-3 text-sm">
          {list.items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={item.done}
                disabled={!canEdit || !onToggle}
                onClick={() => onToggle?.(list.id, item.id)}
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
      <div className="flex gap-2 border-t border-line px-4 py-3">
        {confirm ? (
          <>
            <button type="button" onClick={() => onDelete(list.id)} className={commitButton}>
              确认删除
            </button>
            <button type="button" onClick={() => setConfirm(false)} className={secondaryButton}>
              取消
            </button>
          </>
        ) : (
          <>
            <button type="button" disabled={!canEdit || formOpen} onClick={() => onEdit(list)} className={secondaryButton}>
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

export function ListsTab({
  lists,
  read,
  webLists = [],
  canEdit = false,
  formOpen = false,
  draft = null,
  publishedDone = (_source, _index, _count, fallback) => fallback,
  onBeginCreate,
  onBeginEdit,
  onDelete,
  onSave,
  onCancel,
  onTogglePublished,
  onToggleWeb,
}: {
  lists: ListEntry[]
  read: ReadBlob
  webLists?: WebList[]
  canEdit?: boolean
  formOpen?: boolean
  draft?: { id?: string; title: string; items: { id?: string; text: string; done: boolean }[] } | null
  publishedDone?: (source: string, index: number, itemCount: number, fallback: boolean) => boolean
  onBeginCreate?: () => void
  onBeginEdit?: (list: WebList) => void
  onDelete?: (id: string) => void
  onSave?: (input: { title: string; items: { id?: string; text: string; done: boolean }[] }) => void
  onCancel?: () => void
  onTogglePublished?: (source: string, index: number, done: boolean) => void
  onToggleWeb?: (listId: string, itemId: string) => void
}) {
  const creating = draft !== null && draft.id === undefined
  return (
    <div className="space-y-3">
      {onBeginCreate && (
        <button type="button" disabled={!canEdit || formOpen} onClick={onBeginCreate} className={secondaryButton}>
          新清单
        </button>
      )}
      {creating && <ListForm key="new" initial={draft} onSave={onSave!} onCancel={onCancel!} />}
      {lists.length === 0 && webLists.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">还没有清单</p>
      ) : (
        <ul className="space-y-3">
          {lists.map((list) => (
            <ListCard
              key={list.blob}
              list={list}
              read={read}
              canEdit={canEdit}
              publishedDone={publishedDone}
              onTogglePublished={onTogglePublished}
            />
          ))}
          {webLists.map((list) =>
            draft?.id === list.id ? (
              <li key={list.id}>
                <ListForm key={list.id} initial={draft} onSave={onSave!} onCancel={onCancel!} />
              </li>
            ) : (
              <WebListCard
                key={list.id}
                list={list}
                canEdit={canEdit}
                formOpen={formOpen}
                onEdit={onBeginEdit!}
                onDelete={onDelete!}
                onToggle={onToggleWeb}
              />
            ),
          )}
        </ul>
      )}
    </div>
  )
}
