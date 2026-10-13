import { DecryptError, decryptJson, encryptJson, type VaultKey } from './crypto'

export interface WebNote {
  id: string
  title: string
  date: string
  body: string
  updatedAt: number
}

export interface WebListItem {
  id: string
  text: string
  done: boolean
}

export interface WebList {
  id: string
  title: string
  items: WebListItem[]
  updatedAt: number
}

export interface WebCheck {
  done: boolean
  updatedAt: number
}

export interface WebTombstone {
  id: string
  updatedAt: number
}

export interface WebDoc {
  notes: WebNote[]
  lists: WebList[]
  checks: Record<string, Record<string, WebCheck>>
  tombstones: { notes: WebTombstone[]; lists: WebTombstone[] }
}

export interface WebClock {
  now(): number
  uuid(): string
  today(): string
}

export class WebFileError extends Error {
  constructor() {
    super('网页上的笔记打不开')
    this.name = 'WebFileError'
  }
}

export function emptyWebDoc(): WebDoc {
  return { notes: [], lists: [], checks: {}, tombstones: { notes: [], lists: [] } }
}

export function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function localCalendarToday(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function mergeGroup<T extends { id: string; updatedAt: number }>(
  baseRecords: T[],
  incomingRecords: T[],
  baseTombs: WebTombstone[],
  incomingTombs: WebTombstone[],
): { records: T[]; tombstones: WebTombstone[] } {
  const records = new Map(baseRecords.map((item) => [item.id, structuredClone(item)]))
  const tombs = new Map(baseTombs.map((item) => [item.id, { ...item }]))
  for (const tomb of incomingTombs) {
    const previousTomb = tombs.get(tomb.id)
    if (previousTomb && tomb.updatedAt <= previousTomb.updatedAt) continue
    const record = records.get(tomb.id)
    if (record && tomb.updatedAt <= record.updatedAt) continue
    records.delete(tomb.id)
    tombs.set(tomb.id, { ...tomb })
  }
  for (const record of incomingRecords) {
    const previous = records.get(record.id)
    if (previous && record.updatedAt <= previous.updatedAt) continue
    const tomb = tombs.get(record.id)
    if (tomb && record.updatedAt <= tomb.updatedAt) continue
    tombs.delete(record.id)
    records.set(record.id, structuredClone(record))
  }
  return { records: [...records.values()], tombstones: [...tombs.values()] }
}

function mergeChecks(base: WebDoc['checks'], incoming: WebDoc['checks']): WebDoc['checks'] {
  const out: WebDoc['checks'] = {}
  for (const [source, items] of Object.entries(base)) {
    out[source] = {}
    for (const [index, check] of Object.entries(items)) out[source][index] = { ...check }
  }
  for (const [source, items] of Object.entries(incoming)) {
    const dest = (out[source] ??= {})
    for (const [index, check] of Object.entries(items)) {
      const previous = dest[index]
      if (!previous || check.updatedAt > previous.updatedAt) dest[index] = { ...check }
    }
  }
  return out
}

export function mergeWebDocs(base: WebDoc, incoming: WebDoc): WebDoc {
  const notes = mergeGroup(base.notes, incoming.notes, base.tombstones.notes, incoming.tombstones.notes)
  const lists = mergeGroup(base.lists, incoming.lists, base.tombstones.lists, incoming.tombstones.lists)
  return {
    notes: notes.records,
    lists: lists.records,
    checks: mergeChecks(base.checks, incoming.checks),
    tombstones: { notes: notes.tombstones, lists: lists.tombstones },
  }
}

export function saveWebNote(
  doc: WebDoc,
  input: { id?: string; title: string; date: string; body: string },
  clock: Pick<WebClock, 'now' | 'uuid'>,
): { ok: true; doc: WebDoc } | { ok: false; reason: 'title' | 'date' } {
  const title = input.title.trim()
  if (title === '') return { ok: false, reason: 'title' }
  if (!isRealDate(input.date)) return { ok: false, reason: 'date' }
  const id = input.id ?? clock.uuid()
  const note: WebNote = { id, title, date: input.date, body: input.body, updatedAt: clock.now() }
  return {
    ok: true,
    doc: {
      ...doc,
      notes: [...doc.notes.filter((item) => item.id !== id), note],
      tombstones: { ...doc.tombstones, notes: doc.tombstones.notes.filter((item) => item.id !== id) },
    },
  }
}

export function saveWebList(
  doc: WebDoc,
  input: { id?: string; title: string; items: { id?: string; text: string; done: boolean }[] },
  clock: Pick<WebClock, 'now' | 'uuid'>,
): { ok: true; doc: WebDoc } | { ok: false; reason: 'title' } {
  const title = input.title.trim()
  if (title === '') return { ok: false, reason: 'title' }
  const items: WebListItem[] = []
  for (const item of input.items) {
    const text = item.text.trim()
    if (text === '') continue
    items.push({ id: item.id ?? clock.uuid(), text, done: item.done })
  }
  const id = input.id ?? clock.uuid()
  const list: WebList = { id, title, items, updatedAt: clock.now() }
  return {
    ok: true,
    doc: {
      ...doc,
      lists: [...doc.lists.filter((item) => item.id !== id), list],
      tombstones: { ...doc.tombstones, lists: doc.tombstones.lists.filter((item) => item.id !== id) },
    },
  }
}

export function deleteWebNote(doc: WebDoc, id: string, now: number): WebDoc {
  return {
    ...doc,
    notes: doc.notes.filter((item) => item.id !== id),
    tombstones: {
      ...doc.tombstones,
      notes: [...doc.tombstones.notes.filter((item) => item.id !== id), { id, updatedAt: now }],
    },
  }
}

export function deleteWebList(doc: WebDoc, id: string, now: number): WebDoc {
  return {
    ...doc,
    lists: doc.lists.filter((item) => item.id !== id),
    tombstones: {
      ...doc.tombstones,
      lists: [...doc.tombstones.lists.filter((item) => item.id !== id), { id, updatedAt: now }],
    },
  }
}

export function toggleWebListItem(doc: WebDoc, listId: string, itemId: string, now: number): WebDoc {
  let changed = false
  const lists = doc.lists.map((list) => {
    if (list.id !== listId) return list
    const items = list.items.map((item) => {
      if (item.id !== itemId) return item
      changed = true
      return { ...item, done: !item.done }
    })
    return { ...list, items, updatedAt: now }
  })
  return changed ? { ...doc, lists } : doc
}

export function togglePublishedCheck(doc: WebDoc, source: string, index: number, done: boolean, now: number): WebDoc {
  return {
    ...doc,
    checks: {
      ...doc.checks,
      [source]: { ...doc.checks[source], [String(index)]: { done, updatedAt: now } },
    },
  }
}

export function publishedItemDone(
  doc: WebDoc,
  source: string,
  index: number,
  itemCount: number,
  fallback: boolean,
): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= itemCount) return fallback
  const check = doc.checks[source]?.[String(index)]
  return check ? check.done : fallback
}

export async function sealWebFile(dek: VaultKey, doc: WebDoc): Promise<string> {
  return JSON.stringify({ version: 1, sealed: await encryptJson(dek, doc) })
}

export async function openWebFile(dek: VaultKey, text: string): Promise<WebDoc> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new WebFileError()
  }
  if (!parsed || typeof parsed !== 'object' || (parsed as { version?: unknown }).version !== 1) throw new WebFileError()
  const sealed = (parsed as { sealed?: unknown }).sealed
  if (typeof sealed !== 'string') throw new WebFileError()
  try {
    return await decryptJson<WebDoc>(dek, sealed)
  } catch (error) {
    if (error instanceof DecryptError) throw new WebFileError()
    throw error
  }
}
