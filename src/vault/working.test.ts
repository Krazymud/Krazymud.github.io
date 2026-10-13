// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { decryptBytes, encryptBytes, generateDek } from './crypto'
import { unlockWithKey } from './repo'
import { makeTestVault } from './testVault'
import {
  absorbWebDoc,
  addPhoto,
  deletePhoto,
  emptyWorking,
  mergeWorking,
  saveNote,
  deleteNote,
  sealVaultFile,
  webNoteSource,
  webPhotoSource,
} from './working'
import type { PhotoEntry, VaultManifest } from './types'
import type { WebDoc } from './web'

const baseManifest = (): VaultManifest => ({
  photos: [],
  notes: [{ title: '晚安', date: '2024-05-21', blob: 'note-a', source: 'notes/a.md', hash: 'n' }],
  lists: [],
})

describe('mergeWorking', () => {
  it('lets a newer edit replace a published note by source', async () => {
    const dek = await generateDek()
    const clock = { now: () => 10, uuid: () => 'u1' }
    const base = emptyWorking(baseManifest())
    const edited = await saveNote(
      emptyWorking(baseManifest()),
      { source: 'notes/a.md', title: '改过', date: '2024-05-21', body: '新正文' },
      clock,
      dek,
    )
    const merged = mergeWorking(base, edited)
    expect(merged.manifest.notes).toHaveLength(1)
    expect(merged.manifest.notes[0].title).toBe('改过')
    expect(merged.dirtyBlobs[merged.manifest.notes[0].blob]).toBeInstanceOf(Uint8Array)
  })

  it('hides a published note when the tombstone is newer', () => {
    const base = emptyWorking(baseManifest())
    const incoming = deleteNote(emptyWorking(baseManifest()), 'notes/a.md', 20)
    expect(mergeWorking(base, incoming).manifest.notes).toEqual([])
  })

  it('assigns web/notes/<uuid> for a new note', async () => {
    const dek = await generateDek()
    const next = await saveNote(
      emptyWorking({ photos: [], notes: [], lists: [] }),
      { title: '网页', date: '2026-10-13', body: '' },
      { now: () => 1, uuid: () => 'abc' },
      dek,
    )
    expect(next.manifest.notes[0].source).toBe(webNoteSource('abc'))
  })
})

describe('addPhoto and deletePhoto', () => {
  it('assigns web/photos/<uuid> and seals full and thumb blobs', async () => {
    const dek = await generateDek()
    const full = new Uint8Array([1, 2, 3])
    const thumb = new Uint8Array([4, 5])
    const next = await addPhoto(
      emptyWorking({ photos: [], notes: [], lists: [] }),
      { caption: '海边', date: '2026-10-13', full, thumb, width: 800, height: 600 },
      { now: () => 5, uuid: () => 'pic1' },
      dek,
    )
    const photo = next.manifest.photos[0]
    expect(photo.source).toBe(webPhotoSource('pic1'))
    expect(photo.caption).toBe('海边')
    expect(next.updatedAt[photo.source]).toBe(5)
    expect(next.dirtyBlobs[photo.full]).toBeInstanceOf(Uint8Array)
    expect(next.dirtyBlobs[photo.thumb]).toBeInstanceOf(Uint8Array)
  })

  it('removes a photo and records a tombstone', () => {
    const manifest: VaultManifest = {
      photos: [
        {
          caption: '',
          date: '2024-05-20',
          width: 100,
          height: 100,
          thumb: 't',
          full: 'f',
          source: 'photos/a.jpg',
          hash: 'h',
        },
      ],
      notes: [],
      lists: [],
    }
    const next = deletePhoto(emptyWorking(manifest), 'photos/a.jpg', 99)
    expect(next.manifest.photos).toEqual([])
    expect(next.tombstones.photos).toEqual([{ source: 'photos/a.jpg', updatedAt: 99 }])
  })

  it('hides a published photo when merge sees a newer tombstone', () => {
    const manifest: VaultManifest = {
      photos: [
        {
          caption: '',
          date: '2024-05-20',
          width: 100,
          height: 100,
          thumb: 't',
          full: 'f',
          source: 'photos/a.jpg',
          hash: 'h',
        },
      ],
      notes: [],
      lists: [],
    }
    const base = emptyWorking(manifest)
    const incoming = deletePhoto(emptyWorking(manifest), 'photos/a.jpg', 20)
    expect(mergeWorking(base, incoming).manifest.photos).toEqual([])
  })
})

describe('sealVaultFile', () => {
  it('re-encrypts manifest while keeping kdf and wrappedKey', async () => {
    const vault = await makeTestVault()
    const session = await unlockWithKey(vault.file, vault.dek)
    const working = {
      ...emptyWorking(session.manifest),
      manifest: {
        ...session.manifest,
        notes: [
          ...session.manifest.notes,
          { title: '新', date: '2026-10-13', blob: 'note-new', source: 'web/notes/n1', hash: 'x' },
        ],
      },
    }
    const sealed = await sealVaultFile(vault.dek, working, vault.file)
    expect(sealed.kdf).toEqual(vault.file.kdf)
    expect(sealed.wrappedKey).toBe(vault.file.wrappedKey)
    expect(sealed.manifest).not.toBe(vault.file.manifest)
    const roundTrip = await unlockWithKey(sealed, vault.dek)
    expect(roundTrip.manifest.notes).toHaveLength(2)
    expect(roundTrip.manifest.notes.some((n) => n.title === '新')).toBe(true)
  })

  it('seals photos newest first even when the working order is not', async () => {
    const vault = await makeTestVault()
    const working = emptyWorking({
      photos: [photo('photos/old.jpg', '2023-01-02'), photo('photos/new.jpg', '2025-07-01'), photo('photos/mid.jpg', '2024-03-04')],
      notes: [],
      lists: [],
    })
    const sealed = await sealVaultFile(vault.dek, working, vault.file)
    const roundTrip = await unlockWithKey(sealed, vault.dek)
    expect(roundTrip.manifest.photos.map((p) => p.source)).toEqual(['photos/new.jpg', 'photos/mid.jpg', 'photos/old.jpg'])
  })
})

function photo(source: string, date: string): PhotoEntry {
  return { caption: '', date, width: 1, height: 1, thumb: `${source}-t`, full: `${source}-f`, source, hash: 'h' }
}

describe('photo order', () => {
  const published = (): VaultManifest => ({
    photos: [photo('photos/b.jpg', '2025-05-01'), photo('photos/a.jpg', '2024-05-20')],
    notes: [],
    lists: [],
  })

  it('places an added photo by date, newest first', async () => {
    const dek = await generateDek()
    const bytes = { full: new Uint8Array([1]), thumb: new Uint8Array([2]), width: 1, height: 1, caption: '' }
    let next = await addPhoto(emptyWorking(published()), { ...bytes, date: '2026-10-13' }, { now: () => 1, uuid: () => 'new' }, dek)
    next = await addPhoto(next, { ...bytes, date: '2024-12-01' }, { now: () => 2, uuid: () => 'mid' }, dek)
    expect(next.manifest.photos.map((p) => p.date)).toEqual(['2026-10-13', '2025-05-01', '2024-12-01', '2024-05-20'])
  })

  it('keeps photos newest first after a merge appends incoming records', async () => {
    const dek = await generateDek()
    const bytes = { full: new Uint8Array([1]), thumb: new Uint8Array([2]), width: 1, height: 1, caption: '' }
    const incoming = await addPhoto(
      emptyWorking({ photos: [], notes: [], lists: [] }),
      { ...bytes, date: '2025-01-01' },
      { now: () => 3, uuid: () => 'inc' },
      dek,
    )
    const merged = mergeWorking(emptyWorking(published()), incoming)
    expect(merged.manifest.photos.map((p) => p.date)).toEqual(['2025-05-01', '2025-01-01', '2024-05-20'])
  })
})

describe('absorbWebDoc', () => {
  const doc = (): WebDoc => ({
    notes: [{ id: 'n1', title: '网页笔记', date: '2024-06-01', body: '正文', updatedAt: 50 }],
    lists: [
      {
        id: 'l1',
        title: '网页清单',
        items: [
          { id: 'i1', text: '甲', done: true },
          { id: 'i2', text: '乙', done: false },
        ],
        updatedAt: 60,
      },
    ],
    checks: {},
    tombstones: { notes: [{ id: 'gone', updatedAt: 70 }], lists: [] },
  })
  const clock = { now: () => 999, uuid: () => 'x' }

  it('turns web notes and lists into web/ sources with their own timestamps', async () => {
    const dek = await generateDek()
    const next = await absorbWebDoc(emptyWorking(baseManifest()), doc(), dek, clock)
    const note = next.manifest.notes.find((n) => n.source === 'web/notes/n1')
    const list = next.manifest.lists.find((l) => l.source === 'web/lists/l1')
    expect(note?.title).toBe('网页笔记')
    expect(next.updatedAt['web/notes/n1']).toBe(50)
    expect(list?.title).toBe('网页清单')
    const plain = await decryptBytes(dek, next.dirtyBlobs[list!.blob])
    expect(JSON.parse(new TextDecoder().decode(plain))).toEqual({
      items: [
        { text: '甲', done: true },
        { text: '乙', done: false },
      ],
    })
    expect(next.tombstones.notes).toEqual([{ source: 'web/notes/gone', updatedAt: 70 }])
  })

  it('keeps a newer working record over the web copy', async () => {
    const dek = await generateDek()
    const first = await absorbWebDoc(emptyWorking(baseManifest()), doc(), dek, clock)
    const edited = await saveNote(
      first,
      { source: 'web/notes/n1', title: '更新', date: '2024-06-01', body: 'b' },
      { now: () => 500, uuid: () => 'u' },
      dek,
    )
    const again = await absorbWebDoc(edited, doc(), dek, clock)
    expect(again.manifest.notes.find((n) => n.source === 'web/notes/n1')?.title).toBe('更新')
  })

  it('writes checks into a published list blob by index', async () => {
    const dek = await generateDek()
    const sealed = await encryptBytes(dek, new TextEncoder().encode(JSON.stringify({ items: [{ text: 'a', done: false }, { text: 'b', done: false }] })))
    const manifest: VaultManifest = {
      photos: [],
      notes: [],
      lists: [{ title: '清单', blob: 'lb', source: 'lists/a.md', hash: 'h' }],
    }
    const web = doc()
    web.checks = { 'lists/a.md': { '1': { done: true, updatedAt: 80 }, '9': { done: true, updatedAt: 80 } } }
    const next = await absorbWebDoc(emptyWorking(manifest), web, dek, clock, async (name) => (name === 'lb' ? sealed : null))
    const entry = next.manifest.lists.find((l) => l.source === 'lists/a.md')!
    expect(entry.blob).not.toBe('lb')
    expect(next.updatedAt['lists/a.md']).toBe(80)
    const plain = await decryptBytes(dek, next.dirtyBlobs[entry.blob])
    expect(JSON.parse(new TextDecoder().decode(plain)).items).toEqual([
      { text: 'a', done: false },
      { text: 'b', done: true },
    ])
  })
})
