import type { WordProgress } from './srs'
import type { SessionItem } from './types'

export const DAILY_LIMIT = 20

export function buildSession(
  today: string,
  progress: Record<string, WordProgress>,
  order: string[],
  limit = DAILY_LIMIT,
): SessionItem[] {
  const known = new Set(order)
  const items: SessionItem[] = Object.entries(progress)
    .filter(([word, p]) => known.has(word) && p.due <= today)
    .sort(([wordA, a], [wordB, b]) => (a.due === b.due ? wordA.localeCompare(wordB) : a.due < b.due ? -1 : 1))
    .slice(0, limit)
    .map(([word]) => ({ word, kind: 'review' }))

  for (const word of order) {
    if (items.length >= limit) break
    if (!Object.hasOwn(progress, word)) items.push({ word, kind: 'new' })
  }
  return items
}
