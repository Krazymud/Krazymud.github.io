import { describe, expect, it } from 'vitest'
import { addDays } from '../trial/day'
import { dayHash, todaysMemory } from './memory'
import type { NoteEntry, PhotoEntry, VaultManifest } from './types'

const photo = (date: string, caption = date): PhotoEntry => ({
  caption,
  date,
  width: 1,
  height: 1,
  thumb: `t-${caption}`,
  full: `f-${caption}`,
  source: `photos/${caption}.jpg`,
  hash: caption,
})
const note = (date: string, title = date): NoteEntry => ({ title, date, blob: `n-${title}`, source: `notes/${title}.md`, hash: title })
const vault = (photos: PhotoEntry[], notes: NoteEntry[] = []): VaultManifest => ({ photos, notes, lists: [] })

describe('todaysMemory', () => {
  it('finds a photo from the same day in an earlier year', () => {
    const manifest = vault([photo('2025-03-01'), photo('2024-05-20')])
    expect(todaysMemory(manifest, '2026-05-20')).toEqual({
      kind: 'anniversary',
      years: 2,
      item: { type: 'photo', photo: manifest.photos[1], index: 1 },
    })
  })

  it('prefers the most recent year', () => {
    const manifest = vault([photo('2022-05-20'), photo('2025-05-20'), photo('2023-05-20')])
    expect(todaysMemory(manifest, '2026-05-20')).toMatchObject({ years: 1, item: { index: 1 } })
  })

  it('picks the same one of several from one year all day', () => {
    const manifest = vault([photo('2025-05-20', 'a'), photo('2025-05-20', 'b'), photo('2025-05-20', 'c')])
    const first = todaysMemory(manifest, '2026-05-20')
    expect(todaysMemory(manifest, '2026-05-20')).toEqual(first)
    expect(first).toMatchObject({ years: 1, item: { index: dayHash('2026-05-20') % 3 } })
  })

  it('ignores entries from this year', () => {
    const manifest = vault([photo('2026-05-20')], [note('2026-05-20')])
    expect(todaysMemory(manifest, '2026-05-20')).toMatchObject({ kind: 'daily' })
  })

  it('remembers 29 February on 28 February in common years', () => {
    const manifest = vault([photo('2024-02-29')])
    expect(todaysMemory(manifest, '2025-02-28')).toMatchObject({ kind: 'anniversary', years: 1 })
    expect(todaysMemory(manifest, '2028-02-28')).toMatchObject({ kind: 'daily' })
    expect(todaysMemory(manifest, '2028-02-29')).toMatchObject({ kind: 'anniversary', years: 4 })
  })

  it('prefers a photo over a note', () => {
    const manifest = vault([photo('2020-05-20')], [note('2025-05-20')])
    expect(todaysMemory(manifest, '2026-05-20')).toMatchObject({ years: 6, item: { type: 'photo' } })
  })

  it('falls back to a note anniversary', () => {
    const goodnight = note('2025-05-20', '晚安')
    expect(todaysMemory(vault([photo('2025-01-01')], [goodnight]), '2026-05-20')).toEqual({
      kind: 'anniversary',
      years: 1,
      item: { type: 'note', note: goodnight },
    })
  })

  it('shows a daily photo that holds all day and changes across days', () => {
    const manifest = vault(Array.from({ length: 10 }, (_, i) => photo(`2025-01-${String(i + 1).padStart(2, '0')}`)))
    const day = '2026-05-20'
    expect(todaysMemory(manifest, day)).toEqual(todaysMemory(manifest, day))
    const picks = new Set(
      Array.from({ length: 7 }, (_, i) => {
        const memory = todaysMemory(manifest, addDays(day, i))
        return memory?.kind === 'daily' ? memory.item.index : -1
      }),
    )
    expect(picks.has(-1)).toBe(false)
    expect(picks.size).toBeGreaterThan(1)
  })

  it('shows nothing without photos or an anniversary', () => {
    expect(todaysMemory(vault([]), '2026-05-20')).toBeNull()
    expect(todaysMemory(vault([], [note('2025-01-01')]), '2026-05-20')).toBeNull()
  })
})
