// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { generateDek } from './crypto'
import { unlockWithKey } from './repo'
import { makeTestVault } from './testVault'
import {
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
import type { VaultManifest } from './types'

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
})
