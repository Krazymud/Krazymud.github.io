import {
  decryptBytes,
  decryptJson,
  encryptBytes,
  encryptJson,
  fromBase64,
  toBase64,
  type VaultKey,
} from './crypto.ts'
import { isRealDate, type WebDoc } from './web.ts'
import type { ListContent, ListEntry, ListItem, NoteEntry, PhotoEntry, VaultFile, VaultManifest } from './types.ts'

export type Tombstone = { source: string; updatedAt: number }

export interface WorkingVault {
  manifest: VaultManifest
  updatedAt: Record<string, number>
  tombstones: { notes: Tombstone[]; lists: Tombstone[]; photos: Tombstone[] }
  dirtyBlobs: Record<string, Uint8Array>
}

export class WorkingValidationError extends Error {
  reason: 'title' | 'date'

  constructor(reason: 'title' | 'date') {
    super(reason === 'title' ? '标题不能为空' : '日期无效')
    this.name = 'WorkingValidationError'
    this.reason = reason
  }
}

export class WorkingBlobError extends Error {
  constructor() {
    super('清单内容不可用')
    this.name = 'WorkingBlobError'
  }
}

const encoder = new TextEncoder()

export function webNoteSource(uuid: string): string {
  return `web/notes/${uuid}`
}

export function webListSource(uuid: string): string {
  return `web/lists/${uuid}`
}

export function webPhotoSource(uuid: string): string {
  return `web/photos/${uuid}`
}

export function emptyWorking(manifest: VaultManifest): WorkingVault {
  return {
    manifest: structuredClone(manifest),
    updatedAt: {},
    tombstones: { notes: [], lists: [], photos: [] },
    dirtyBlobs: {},
  }
}

function randomBlobName(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Same order as scripts/lib/vaultBuild.ts; PhotoGrid groups consecutive photos by month.
function byDateDesc(a: { date: string; source: string }, b: { date: string; source: string }): number {
  if (a.date === b.date) return a.source.localeCompare(b.source)
  return a.date < b.date ? 1 : -1
}

function sortPhotos(photos: PhotoEntry[]): PhotoEntry[] {
  return [...photos].sort(byDateDesc)
}

function removeTombstone(tombs: Tombstone[], source: string): Tombstone[] {
  return tombs.filter((item) => item.source !== source)
}

function addTombstone(tombs: Tombstone[], source: string, updatedAt: number): Tombstone[] {
  return [...removeTombstone(tombs, source), { source, updatedAt }]
}

type Side = 'base' | 'incoming'

function mergeBySource<T extends { source: string }>(
  baseRecords: T[],
  incomingRecords: T[],
  baseTombs: Tombstone[],
  incomingTombs: Tombstone[],
  baseTimes: Record<string, number>,
  incomingTimes: Record<string, number>,
): { records: T[]; tombstones: Tombstone[]; times: Record<string, number>; winners: Map<string, Side> } {
  const records = new Map(baseRecords.map((item) => [item.source, structuredClone(item)]))
  const tombs = new Map(baseTombs.map((item) => [item.source, { ...item }]))
  const times: Record<string, number> = { ...baseTimes }
  const winners = new Map<string, Side>()

  for (const source of new Set(records.keys())) winners.set(source, 'base')

  for (const tomb of incomingTombs) {
    const previousTomb = tombs.get(tomb.source)
    if (previousTomb && tomb.updatedAt <= previousTomb.updatedAt) continue
    const record = records.get(tomb.source)
    const recordAt = times[tomb.source] ?? 0
    if (record && tomb.updatedAt <= recordAt) continue
    records.delete(tomb.source)
    tombs.set(tomb.source, { ...tomb })
    times[tomb.source] = Math.max(times[tomb.source] ?? 0, tomb.updatedAt)
    winners.delete(tomb.source)
  }

  for (const record of incomingRecords) {
    const incomingAt = incomingTimes[record.source] ?? 0
    const previous = records.get(record.source)
    const previousAt = times[record.source] ?? 0
    if (previous && incomingAt <= previousAt) continue
    const tomb = tombs.get(record.source)
    if (tomb && incomingAt <= tomb.updatedAt) continue
    tombs.delete(record.source)
    records.set(record.source, structuredClone(record))
    times[record.source] = Math.max(previousAt, incomingAt)
    winners.set(record.source, 'incoming')
  }

  for (const [source, at] of Object.entries(incomingTimes)) {
    if (times[source] === undefined) times[source] = at
    else times[source] = Math.max(times[source], at)
  }

  return { records: [...records.values()], tombstones: [...tombs.values()], times, winners }
}

function collectDirtyBlobs(
  entries: { source: string; blobs: string[] }[],
  winners: Map<string, Side>,
  base: WorkingVault,
  incoming: WorkingVault,
): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {}
  for (const { source, blobs } of entries) {
    const side = winners.get(source)
    if (!side) continue
    const store = side === 'base' ? base.dirtyBlobs : incoming.dirtyBlobs
    for (const name of blobs) {
      const bytes = store[name]
      if (bytes) out[name] = bytes
    }
  }
  return out
}

export function mergeWorking(base: WorkingVault, incoming: WorkingVault): WorkingVault {
  const notes = mergeBySource(
    base.manifest.notes,
    incoming.manifest.notes,
    base.tombstones.notes,
    incoming.tombstones.notes,
    base.updatedAt,
    incoming.updatedAt,
  )
  const lists = mergeBySource(
    base.manifest.lists,
    incoming.manifest.lists,
    base.tombstones.lists,
    incoming.tombstones.lists,
    base.updatedAt,
    incoming.updatedAt,
  )
  const photos = mergeBySource(
    base.manifest.photos,
    incoming.manifest.photos,
    base.tombstones.photos,
    incoming.tombstones.photos,
    base.updatedAt,
    incoming.updatedAt,
  )

  const updatedAt = { ...base.updatedAt, ...incoming.updatedAt }
  for (const [source, at] of Object.entries(notes.times)) updatedAt[source] = at
  for (const [source, at] of Object.entries(lists.times)) updatedAt[source] = at
  for (const [source, at] of Object.entries(photos.times)) updatedAt[source] = at

  const noteBlobRefs = notes.records.map((n) => ({ source: n.source, blobs: [n.blob] }))
  const listBlobRefs = lists.records.map((l) => ({ source: l.source, blobs: [l.blob] }))
  const photoBlobRefs = photos.records.map((p) => ({ source: p.source, blobs: [p.thumb, p.full] }))

  const dirtyBlobs = {
    ...collectDirtyBlobs(noteBlobRefs, notes.winners, base, incoming),
    ...collectDirtyBlobs(listBlobRefs, lists.winners, base, incoming),
    ...collectDirtyBlobs(photoBlobRefs, photos.winners, base, incoming),
  }

  return {
    manifest: {
      photos: sortPhotos(photos.records),
      notes: notes.records,
      lists: lists.records,
    },
    updatedAt,
    tombstones: {
      notes: notes.tombstones,
      lists: lists.tombstones,
      photos: photos.tombstones,
    },
    dirtyBlobs,
  }
}

export async function saveNote(
  working: WorkingVault,
  input: { source?: string; title: string; date: string; body: string },
  clock: { now(): number; uuid(): string },
  dek: VaultKey,
): Promise<WorkingVault> {
  const title = input.title.trim()
  if (title === '') throw new WorkingValidationError('title')
  if (!isRealDate(input.date)) throw new WorkingValidationError('date')

  const source = input.source ?? webNoteSource(clock.uuid())
  const plain = encoder.encode(input.body)
  const hash = await sha256Hex(plain)
  const blob = randomBlobName()
  const sealed = await encryptBytes(dek, plain)
  const entry: NoteEntry = { title, date: input.date, blob, source, hash }

  return {
    manifest: {
      ...working.manifest,
      notes: [...working.manifest.notes.filter((item) => item.source !== source), entry],
    },
    updatedAt: { ...working.updatedAt, [source]: clock.now() },
    tombstones: { ...working.tombstones, notes: removeTombstone(working.tombstones.notes, source) },
    dirtyBlobs: { ...working.dirtyBlobs, [blob]: sealed },
  }
}

export function deleteNote(working: WorkingVault, source: string, now: number): WorkingVault {
  return {
    manifest: {
      ...working.manifest,
      notes: working.manifest.notes.filter((item) => item.source !== source),
    },
    updatedAt: { ...working.updatedAt, [source]: now },
    tombstones: {
      ...working.tombstones,
      notes: addTombstone(working.tombstones.notes, source, now),
    },
    dirtyBlobs: { ...working.dirtyBlobs },
  }
}

function normalizeListItems(
  items: { text: string; done: boolean }[],
): ListItem[] {
  const out: ListItem[] = []
  for (const item of items) {
    const text = item.text.trim()
    if (text === '') continue
    out.push({ text, done: item.done })
  }
  return out
}

export async function saveList(
  working: WorkingVault,
  input: { source?: string; title: string; items: { text: string; done: boolean }[] },
  clock: { now(): number; uuid(): string },
  dek: VaultKey,
): Promise<WorkingVault> {
  const title = input.title.trim()
  if (title === '') throw new WorkingValidationError('title')

  const source = input.source ?? webListSource(clock.uuid())
  const content: ListContent = { items: normalizeListItems(input.items) }
  const plain = encoder.encode(JSON.stringify(content))
  const hash = await sha256Hex(plain)
  const blob = randomBlobName()
  const sealed = await encryptBytes(dek, plain)
  const entry: ListEntry = { title, blob, source, hash }

  return {
    manifest: {
      ...working.manifest,
      lists: [...working.manifest.lists.filter((item) => item.source !== source), entry],
    },
    updatedAt: { ...working.updatedAt, [source]: clock.now() },
    tombstones: { ...working.tombstones, lists: removeTombstone(working.tombstones.lists, source) },
    dirtyBlobs: { ...working.dirtyBlobs, [blob]: sealed },
  }
}

export function deleteList(working: WorkingVault, source: string, now: number): WorkingVault {
  return {
    manifest: {
      ...working.manifest,
      lists: working.manifest.lists.filter((item) => item.source !== source),
    },
    updatedAt: { ...working.updatedAt, [source]: now },
    tombstones: {
      ...working.tombstones,
      lists: addTombstone(working.tombstones.lists, source, now),
    },
    dirtyBlobs: { ...working.dirtyBlobs },
  }
}

export async function addPhoto(
  working: WorkingVault,
  input: {
    caption: string
    date: string
    full: Uint8Array
    thumb: Uint8Array
    width: number
    height: number
  },
  clock: { now(): number; uuid(): string },
  dek: VaultKey,
): Promise<WorkingVault> {
  if (!isRealDate(input.date)) throw new WorkingValidationError('date')

  const source = webPhotoSource(clock.uuid())
  const hash = await sha256Hex(input.full)
  const fullBlob = randomBlobName()
  const thumbBlob = randomBlobName()
  const sealedFull = await encryptBytes(dek, input.full)
  const sealedThumb = await encryptBytes(dek, input.thumb)
  const entry: PhotoEntry = {
    caption: input.caption.trim(),
    date: input.date,
    width: input.width,
    height: input.height,
    thumb: thumbBlob,
    full: fullBlob,
    source,
    hash,
  }

  return {
    manifest: {
      ...working.manifest,
      photos: sortPhotos([...working.manifest.photos, entry]),
    },
    updatedAt: { ...working.updatedAt, [source]: clock.now() },
    tombstones: { ...working.tombstones, photos: removeTombstone(working.tombstones.photos, source) },
    dirtyBlobs: { ...working.dirtyBlobs, [fullBlob]: sealedFull, [thumbBlob]: sealedThumb },
  }
}

export function deletePhoto(working: WorkingVault, source: string, now: number): WorkingVault {
  return {
    manifest: {
      ...working.manifest,
      photos: working.manifest.photos.filter((item) => item.source !== source),
    },
    updatedAt: { ...working.updatedAt, [source]: now },
    tombstones: {
      ...working.tombstones,
      photos: addTombstone(working.tombstones.photos, source, now),
    },
    dirtyBlobs: { ...working.dirtyBlobs },
  }
}

export async function sealVaultFile(
  dek: VaultKey,
  working: WorkingVault,
  previous: VaultFile,
): Promise<VaultFile> {
  return {
    version: previous.version,
    kdf: previous.kdf,
    wrappedKey: previous.wrappedKey,
    manifest: await encryptJson(dek, { ...working.manifest, photos: sortPhotos(working.manifest.photos) }),
  }
}

export async function toggleListItem(
  working: WorkingVault,
  source: string,
  index: number,
  done: boolean,
  now: number,
  dek: VaultKey,
): Promise<WorkingVault> {
  const entry = working.manifest.lists.find((item) => item.source === source)
  if (!entry) return working

  const sealed = working.dirtyBlobs[entry.blob]
  if (!sealed) throw new WorkingBlobError()

  const plain = await decryptBytes(dek, sealed)
  const content = JSON.parse(new TextDecoder().decode(plain)) as ListContent
  if (!Number.isInteger(index) || index < 0 || index >= content.items.length) return working

  const items = content.items.map((item, i) => (i === index ? { ...item, done } : item))
  const nextContent: ListContent = { items }
  const nextPlain = encoder.encode(JSON.stringify(nextContent))
  const hash = await sha256Hex(nextPlain)
  const blob = randomBlobName()
  const nextSealed = await encryptBytes(dek, nextPlain)
  const nextEntry: ListEntry = { ...entry, blob, hash }

  return {
    manifest: {
      ...working.manifest,
      lists: working.manifest.lists.map((item) => (item.source === source ? nextEntry : item)),
    },
    updatedAt: { ...working.updatedAt, [source]: now },
    tombstones: { ...working.tombstones, lists: removeTombstone(working.tombstones.lists, source) },
    dirtyBlobs: { ...working.dirtyBlobs, [blob]: nextSealed },
  }
}

interface SealedWorkingPayload {
  manifest: VaultManifest
  updatedAt: Record<string, number>
  tombstones: WorkingVault['tombstones']
  dirtyBlobs: Record<string, string>
}

export async function sealWorking(dek: VaultKey, working: WorkingVault): Promise<string> {
  const dirtyBlobs: Record<string, string> = {}
  for (const [name, bytes] of Object.entries(working.dirtyBlobs)) dirtyBlobs[name] = toBase64(bytes)
  const payload: SealedWorkingPayload = {
    manifest: working.manifest,
    updatedAt: working.updatedAt,
    tombstones: working.tombstones,
    dirtyBlobs,
  }
  return JSON.stringify({ version: 1, sealed: await encryptJson(dek, payload) })
}

export async function openWorking(dek: VaultKey, text: string): Promise<WorkingVault> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new WorkingBlobError()
  }
  if (!parsed || typeof parsed !== 'object' || (parsed as { version?: unknown }).version !== 1) {
    throw new WorkingBlobError()
  }
  const sealed = (parsed as { sealed?: unknown }).sealed
  if (typeof sealed !== 'string') throw new WorkingBlobError()

  const payload = await decryptJson<SealedWorkingPayload>(dek, sealed)
  const dirtyBlobs: Record<string, Uint8Array> = {}
  for (const [name, encoded] of Object.entries(payload.dirtyBlobs ?? {})) {
    dirtyBlobs[name] = fromBase64(encoded)
  }
  return {
    manifest: payload.manifest,
    updatedAt: payload.updatedAt ?? {},
    tombstones: payload.tombstones ?? { notes: [], lists: [], photos: [] },
    dirtyBlobs,
  }
}

export async function absorbWebDoc(
  working: WorkingVault,
  webDoc: WebDoc,
  dek: VaultKey,
  clock: { now(): number; uuid(): string },
  loadBlob?: (name: string) => Promise<Uint8Array | null>,
): Promise<WorkingVault> {
  let next = working
  const known = (source: string) => Math.max(next.updatedAt[source] ?? 0, ...next.tombstones.notes.concat(next.tombstones.lists).filter((t) => t.source === source).map((t) => t.updatedAt))
  const at = (updatedAt: number) => ({ now: () => updatedAt, uuid: clock.uuid })

  for (const tomb of webDoc.tombstones.notes) {
    const source = webNoteSource(tomb.id)
    if (tomb.updatedAt > known(source)) next = deleteNote(next, source, tomb.updatedAt)
  }
  for (const tomb of webDoc.tombstones.lists) {
    const source = webListSource(tomb.id)
    if (tomb.updatedAt > known(source)) next = deleteList(next, source, tomb.updatedAt)
  }

  for (const note of webDoc.notes) {
    const source = webNoteSource(note.id)
    if (note.updatedAt <= known(source)) continue
    try {
      next = await saveNote(next, { source, title: note.title, date: note.date, body: note.body }, at(note.updatedAt), dek)
    } catch (error) {
      if (!(error instanceof WorkingValidationError)) throw error
    }
  }
  for (const list of webDoc.lists) {
    const source = webListSource(list.id)
    if (list.updatedAt <= known(source)) continue
    try {
      next = await saveList(
        next,
        { source, title: list.title, items: list.items.map((item) => ({ text: item.text, done: item.done })) },
        at(list.updatedAt),
        dek,
      )
    } catch (error) {
      if (!(error instanceof WorkingValidationError)) throw error
    }
  }

  for (const [source, items] of Object.entries(webDoc.checks)) {
    const entry = next.manifest.lists.find((item) => item.source === source)
    if (!entry) continue
    const sealed = next.dirtyBlobs[entry.blob] ?? (await loadBlob?.(entry.blob)) ?? null
    if (!sealed) throw new WorkingBlobError()
    const content = JSON.parse(new TextDecoder().decode(await decryptBytes(dek, sealed))) as ListContent
    let latest = 0
    let changed = false
    const listItems = content.items.map((item) => ({ ...item }))
    for (const [key, check] of Object.entries(items)) {
      const index = Number(key)
      if (!Number.isInteger(index) || index < 0 || index >= listItems.length) continue
      if (check.updatedAt <= (next.updatedAt[source] ?? 0)) continue
      listItems[index].done = check.done
      latest = Math.max(latest, check.updatedAt)
      changed = true
    }
    if (!changed) continue
    const plain = encoder.encode(JSON.stringify({ items: listItems } satisfies ListContent))
    const blob = randomBlobName()
    const nextEntry: ListEntry = { ...entry, blob, hash: await sha256Hex(plain) }
    next = {
      ...next,
      manifest: { ...next.manifest, lists: next.manifest.lists.map((item) => (item.source === source ? nextEntry : item)) },
      updatedAt: { ...next.updatedAt, [source]: latest },
      dirtyBlobs: { ...next.dirtyBlobs, [blob]: await encryptBytes(dek, plain) },
    }
  }
  return next
}
