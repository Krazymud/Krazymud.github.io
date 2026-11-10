import { useEffect, useState } from 'react'
import type { ListEntry, ListItem, NoteEntry } from '../../vault/types'
import { localCalendarToday } from '../../vault/web'
import { useDarkroomVault } from '../VaultBridge'

type Mode = 'notes' | 'lists'

const decoder = new TextDecoder()

function NoteLetter({ note }: { note: NoteEntry | null }) {
  const { readBlob, saveNote, deleteNote } = useDarkroomVault()
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
    setStatus(result.ok ? '已保存' : `保存失败：${result.reason}`)
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
        <button type="button" onClick={save} className="border border-[#2a2218] px-3 py-1">保存</button>
        {note && (
          <button type="button" onClick={() => void deleteNote(note.source)} className="border border-[#8a2a1f] px-3 py-1 text-[#8a2a1f]">
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

function ListLetter({ list }: { list: ListEntry | null }) {
  const { readBlob, saveList, deleteList, toggleListItem } = useDarkroomVault()
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
      setStatus(`保存失败：${result.reason}`)
    }
  }

  async function save() {
    const next = [...items, ...draft.split('\n').map((t) => t.trim()).filter(Boolean).map((text) => ({ text, done: false }))]
    const result = await saveList({ source: list?.source, title, items: next })
    if (result.ok) {
      setItems(next)
      setDraft('')
    }
    setStatus(result.ok ? '已保存' : `保存失败：${result.reason}`)
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
              <input type="checkbox" checked={item.done} onChange={(e) => void toggle(i, e.target.checked)} />
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
        <button type="button" onClick={save} className="border border-[#2f5d4a] px-3 py-1">保存</button>
        {list && (
          <button type="button" onClick={() => void deleteList(list.source)} className="border border-[#8a2a1f] px-3 py-1 text-[#8a2a1f]">
            作废
          </button>
        )}
        <span role="status">{status}</span>
      </div>
    </article>
  )
}

export function LetterOverlay({ onClose, initialMode = 'notes' }: { onClose: () => void; initialMode?: Mode }) {
  const { notes, lists } = useDarkroomVault()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [noteSource, setNoteSource] = useState<string | 'new' | null>(null)
  const [listSource, setListSource] = useState<string | 'new' | null>(null)

  const note = notes.find((n) => n.source === noteSource) ?? null
  const list = lists.find((l) => l.source === listSource) ?? null

  return (
    <section data-testid="letter-overlay" role="dialog" aria-label="信件" className="absolute inset-y-8 right-8 z-10 w-[min(26rem,90vw)] overflow-y-auto">
      <div className="mb-2 flex gap-2 text-xs">
        <button type="button" aria-pressed={mode === 'notes'} onClick={() => setMode('notes')} className="border border-line px-3 py-1 text-fg aria-pressed:bg-accent/30">
          笔记
        </button>
        <button type="button" aria-pressed={mode === 'lists'} onClick={() => setMode('lists')} className="border border-line px-3 py-1 text-fg aria-pressed:bg-accent/30">
          清单
        </button>
        <button type="button" onClick={onClose} className="ml-auto border border-line px-3 py-1 text-muted">
          放回
        </button>
      </div>
      {mode === 'notes' ? (
        <>
          <ul className="mb-2 space-y-1 text-xs text-fg">
            {notes.map((n) => (
              <li key={n.source}>
                <button type="button" onClick={() => setNoteSource(n.source)}>{n.title}</button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setNoteSource('new')} className="mb-2 border border-line px-3 py-1 text-xs text-fg">
            空白信纸
          </button>
          {noteSource !== null && <NoteLetter key={noteSource} note={note} />}
        </>
      ) : (
        <>
          <ul className="mb-2 space-y-1 text-xs text-fg">
            {lists.map((l) => (
              <li key={l.source}>
                <button type="button" onClick={() => setListSource(l.source)}>{l.title}</button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setListSource('new')} className="mb-2 border border-line px-3 py-1 text-xs text-fg">
            空白表格
          </button>
          {listSource !== null && <ListLetter key={listSource} list={list} />}
        </>
      )}
    </section>
  )
}
