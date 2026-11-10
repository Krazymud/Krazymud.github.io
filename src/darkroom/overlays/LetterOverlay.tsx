import { useEffect, useRef, useState } from 'react'
import type { ListEntry, ListItem, NoteEntry } from '../../vault/types'
import { copy } from '../../config/copy'
import { localCalendarToday } from '../../vault/web'
import { editBlockedMessage, failureMessage, gateOf } from '../mutateCopy'
import { useDarkroomVault } from '../VaultBridge'
import { EditNotice } from './EditNotice'

type Mode = 'notes' | 'lists'

const decoder = new TextDecoder()

interface LetterProps {
  onCreated: () => void
  onDeleted: () => void
}

function NoteLetter({ note, onCreated, onDeleted }: LetterProps & { note: NoteEntry | null }) {
  const vault = useDarkroomVault()
  const { readBlob, saveNote, deleteNote } = vault
  const gate = gateOf(vault)
  const blocked = editBlockedMessage(gate) !== null
  const [title, setTitle] = useState(note?.title ?? '')
  const [date, setDate] = useState(note?.date ?? localCalendarToday(new Date()))
  const [body, setBody] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!note) return
    let alive = true
    readBlob(note.blob).then(
      (bytes) => alive && setBody(decoder.decode(bytes)),
      () => alive && setStatus('读取失败'),
    )
    return () => {
      alive = false
    }
  }, [note, readBlob])

  async function save() {
    const result = await saveNote({ source: note?.source, title, date, body })
    setStatus(result.ok ? '已保存' : failureMessage(result, gate))
    if (result.ok && !note) onCreated()
  }

  async function remove() {
    if (!note) return
    const result = await deleteNote(note.source)
    if (result.ok) onDeleted()
    else setStatus(failureMessage(result, gate))
  }

  return (
    <article data-testid="note-letter" data-stationery="typewriter" className="relative bg-[#efe6cf] p-4 font-mono text-[#2a2218] shadow-lg">
      <span className="absolute right-3 top-2 -rotate-6 border border-[#8a2a1f] px-2 text-[10px] tracking-widest text-[#8a2a1f]">来信</span>
      <label className="block text-xs">
        标题
        <input aria-label="标题" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full border-b border-[#2a2218] bg-transparent font-mono" />
      </label>
      <label className="mt-2 block text-xs">
        日期
        <input aria-label="日期" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block w-full border-b border-[#2a2218] bg-transparent font-mono" />
      </label>
      <textarea aria-label="正文" value={body} onChange={(e) => setBody(e.target.value)} rows={8} className="mt-3 block w-full bg-transparent font-mono text-sm" />
      <div className="mt-2 flex items-center gap-3 text-xs">
        <button type="button" disabled={blocked} onClick={() => void save()} className="border border-[#2a2218] px-3 py-2 disabled:opacity-40">保存</button>
        {note && (
          <button type="button" disabled={blocked} onClick={() => void remove()} className="border border-[#8a2a1f] px-3 py-2 text-[#8a2a1f] disabled:opacity-40">
            撕掉
          </button>
        )}
        <span role="status">{status}</span>
      </div>
    </article>
  )
}

function parseItems(text: string): ListItem[] {
  try {
    const value = JSON.parse(text) as { items?: ListItem[] }
    return Array.isArray(value.items) ? value.items : []
  } catch {
    return []
  }
}

function ListLetter({ list, onCreated, onDeleted }: LetterProps & { list: ListEntry | null }) {
  const vault = useDarkroomVault()
  const { readBlob, saveList, deleteList, toggleListItem } = vault
  const gate = gateOf(vault)
  const blocked = editBlockedMessage(gate) !== null
  const [title, setTitle] = useState(list?.title ?? '')
  const [items, setItems] = useState<ListItem[]>([])
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!list) return
    let alive = true
    readBlob(list.blob).then(
      (bytes) => alive && setItems(parseItems(decoder.decode(bytes))),
      () => alive && setStatus('读取失败'),
    )
    return () => {
      alive = false
    }
  }, [list, readBlob])

  async function toggle(index: number, done: boolean) {
    if (!list) return
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, done } : item)))
    const result = await toggleListItem(list.source, index, done)
    if (!result.ok) {
      setItems((prev) => prev.map((item, i) => (i === index ? { ...item, done: !done } : item)))
      setStatus(failureMessage(result, gate))
    }
  }

  async function save() {
    const next = [...items, ...draft.split('\n').map((t) => t.trim()).filter(Boolean).map((text) => ({ text, done: false }))]
    const result = await saveList({ source: list?.source, title, items: next })
    if (result.ok) {
      setItems(next)
      setDraft('')
    }
    setStatus(result.ok ? '已保存' : failureMessage(result, gate))
    if (result.ok && !list) onCreated()
  }

  async function remove() {
    if (!list) return
    const result = await deleteList(list.source)
    if (result.ok) onDeleted()
    else setStatus(failureMessage(result, gate))
  }

  return (
    <article data-testid="list-letter" data-stationery="form" className="relative border-2 border-dashed border-[#2f5d4a] bg-[#dbe8df] p-4 font-sans text-[#14281f] shadow-lg">
      <span className="absolute right-3 top-2 rotate-3 rounded-full border border-[#2f5d4a] px-2 text-[10px] text-[#2f5d4a]">清单</span>
      <label className="block text-xs font-bold">
        事项名称
        <input aria-label="事项名称" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full border border-[#2f5d4a] bg-white/60 px-1" />
      </label>
      <ul className="mt-3 space-y-1 text-sm">
        {items.map((item, i) => (
          <li key={i}>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={item.done} disabled={blocked || !list} onChange={(e) => void toggle(i, e.target.checked)} />
              <span className={item.done ? 'line-through opacity-60' : ''}>{item.text}</span>
            </label>
          </li>
        ))}
      </ul>
      <label className="mt-3 block text-xs font-bold">
        新增条目（每行一项）
        <textarea aria-label="新增条目" value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} className="mt-1 block w-full border border-[#2f5d4a] bg-white/60 px-1" />
      </label>
      <div className="mt-2 flex items-center gap-3 text-xs">
        <button type="button" disabled={blocked} onClick={() => void save()} className="border border-[#2f5d4a] px-3 py-2 disabled:opacity-40">保存</button>
        {list && (
          <button type="button" disabled={blocked} onClick={() => void remove()} className="border border-[#8a2a1f] px-3 py-2 text-[#8a2a1f] disabled:opacity-40">
            作废
          </button>
        )}
        <span role="status">{status}</span>
      </div>
    </article>
  )
}

export function LetterOverlay({ onClose, onNeedGate, initialMode = 'notes' }: { onClose: () => void; onNeedGate?: () => void; initialMode?: Mode }) {
  const vault = useDarkroomVault()
  const { notes, lists } = vault
  const gate = gateOf(vault)
  const [mode, setMode] = useState<Mode>(initialMode)
  const [noteSource, setNoteSource] = useState<string | 'new' | null>(null)
  const [listSource, setListSource] = useState<string | 'new' | null>(null)
  const [noteCreated, setNoteCreated] = useState(false)
  const [listCreated, setListCreated] = useState(false)
  const noteBase = useRef<Set<string>>(new Set())
  const listBase = useRef<Set<string>>(new Set())

  const note = notes.find((n) => n.source === noteSource) ?? null
  const list = lists.find((l) => l.source === listSource) ?? null

  useEffect(() => {
    if (!noteCreated || noteSource !== 'new') return
    const created = notes.find((n) => !noteBase.current.has(n.source))
    if (created) {
      setNoteSource(created.source)
      setNoteCreated(false)
    }
  }, [noteCreated, noteSource, notes])

  useEffect(() => {
    if (!listCreated || listSource !== 'new') return
    const created = lists.find((l) => !listBase.current.has(l.source))
    if (created) {
      setListSource(created.source)
      setListCreated(false)
    }
  }, [listCreated, listSource, lists])

  return (
    <section data-testid="letter-overlay" role="dialog" aria-label="信件" className="absolute bottom-3 right-3 top-20 z-10 w-[min(26rem,calc(100vw-1.5rem))] overflow-y-auto sm:bottom-8 sm:right-8">
      <div className="mb-2 flex gap-2 text-xs">
        <button type="button" aria-pressed={mode === 'notes'} onClick={() => setMode('notes')} className="dr-btn dr-panel px-3 py-2">
          笔记
        </button>
        <button type="button" aria-pressed={mode === 'lists'} onClick={() => setMode('lists')} className="dr-btn dr-panel px-3 py-2">
          清单
        </button>
        <button type="button" onClick={onClose} className="dr-btn dr-panel ml-auto px-3 py-2">
          {copy.darkroom.back}
        </button>
      </div>
      <EditNotice message={editBlockedMessage(gate)} gate={gate} onNeedGate={onNeedGate} />
      {mode === 'notes' ? (
        <>
          <ul className="dr-panel mb-2 space-y-1 p-2 text-xs">
            {notes.map((n) => (
              <li key={n.source}>
                <button type="button" aria-current={n.source === noteSource} onClick={() => setNoteSource(n.source)} className="py-1 text-left aria-[current=true]:underline">
                  {n.title}
                </button>
              </li>
            ))}
            {notes.length === 0 && <li className="dr-muted">还没有信</li>}
          </ul>
          <button
            type="button"
            onClick={() => {
              noteBase.current = new Set(notes.map((n) => n.source))
              setNoteCreated(false)
              setNoteSource('new')
            }}
            className="dr-btn dr-panel mb-2 px-3 py-2 text-xs"
          >
            空白信纸
          </button>
          {noteSource !== null && (
            <NoteLetter
              key={noteSource}
              note={note}
              onCreated={() => setNoteCreated(true)}
              onDeleted={() => setNoteSource(null)}
            />
          )}
        </>
      ) : (
        <>
          <ul className="dr-panel mb-2 space-y-1 p-2 text-xs">
            {lists.map((l) => (
              <li key={l.source}>
                <button type="button" aria-current={l.source === listSource} onClick={() => setListSource(l.source)} className="py-1 text-left aria-[current=true]:underline">
                  {l.title}
                </button>
              </li>
            ))}
            {lists.length === 0 && <li className="dr-muted">还没有清单</li>}
          </ul>
          <button
            type="button"
            onClick={() => {
              listBase.current = new Set(lists.map((l) => l.source))
              setListCreated(false)
              setListSource('new')
            }}
            className="dr-btn dr-panel mb-2 px-3 py-2 text-xs"
          >
            空白表格
          </button>
          {listSource !== null && (
            <ListLetter
              key={listSource}
              list={list}
              onCreated={() => setListCreated(true)}
              onDeleted={() => setListSource(null)}
            />
          )}
        </>
      )}
    </section>
  )
}
