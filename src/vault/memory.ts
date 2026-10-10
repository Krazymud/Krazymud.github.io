import type { NoteEntry, PhotoEntry, VaultManifest } from './types'

export type MemoryPhoto = { type: 'photo'; photo: PhotoEntry; index: number }
export type MemoryItem = MemoryPhoto | { type: 'note'; note: NoteEntry }
export type Memory = { kind: 'anniversary'; years: number; item: MemoryItem } | { kind: 'daily'; item: MemoryPhoto }

export function dayHash(day: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < day.length; i++) {
    hash ^= day.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

const yearOf = (date: string) => Number(date.slice(0, 4))

function isLeap(year: number): boolean {
  return new Date(year, 1, 29).getMonth() === 1
}

function sameMonthDay(date: string, today: string): boolean {
  const monthDay = date.slice(5)
  const todayMonthDay = today.slice(5)
  if (monthDay === todayMonthDay) return true
  return monthDay === '02-29' && todayMonthDay === '02-28' && !isLeap(yearOf(today))
}

function pickAnniversary<T extends { date: string }>(items: T[], today: string): T | null {
  const hits = items.filter((item) => yearOf(item.date) < yearOf(today) && sameMonthDay(item.date, today))
  if (hits.length === 0) return null
  const latest = Math.max(...hits.map((item) => yearOf(item.date)))
  const top = hits.filter((item) => yearOf(item.date) === latest)
  return top[dayHash(today) % top.length]
}

export function todaysMemory(manifest: VaultManifest, today: string): Memory | null {
  const years = (date: string) => yearOf(today) - yearOf(date)
  const photo = pickAnniversary(manifest.photos, today)
  if (photo) {
    return { kind: 'anniversary', years: years(photo.date), item: { type: 'photo', photo, index: manifest.photos.indexOf(photo) } }
  }
  const note = pickAnniversary(manifest.notes, today)
  if (note) return { kind: 'anniversary', years: years(note.date), item: { type: 'note', note } }
  if (manifest.photos.length === 0) return null
  const index = dayHash(today) % manifest.photos.length
  return { kind: 'daily', item: { type: 'photo', photo: manifest.photos[index], index } }
}
