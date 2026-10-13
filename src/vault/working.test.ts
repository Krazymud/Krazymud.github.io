// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { generateDek } from './crypto'
import { emptyWorking, mergeWorking, saveNote, deleteNote, webNoteSource } from './working'
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
