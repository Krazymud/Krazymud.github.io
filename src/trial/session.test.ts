import { describe, expect, it } from 'vitest'
import { buildSession } from './session'
import type { WordProgress } from './srs'

const TODAY = '2026-10-09'

function due(day: string): WordProgress {
  return { interval: 3, due: day, lastResult: 'ok', seenCount: 1 }
}

describe('buildSession', () => {
  it('puts due reviews first, most overdue first, then fills with new words in order', () => {
    const progress = { bravo: due('2026-10-09'), alpha: due('2026-10-01'), charlie: due('2026-10-20') }
    const order = ['alpha', 'bravo', 'charlie', 'delta', 'echo']
    expect(buildSession(TODAY, progress, order, 4)).toEqual([
      { word: 'alpha', kind: 'review' },
      { word: 'bravo', kind: 'review' },
      { word: 'delta', kind: 'new' },
      { word: 'echo', kind: 'new' },
    ])
  })

  it('caps the day at the limit and leaves extra reviews for later', () => {
    const progress = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`w${i}`, due('2026-10-01')]))
    const order = [...Object.keys(progress), 'fresh']
    const items = buildSession(TODAY, progress, order)
    expect(items).toHaveLength(20)
    expect(items.every((item) => item.kind === 'review')).toBe(true)
  })

  it('breaks ties between equally overdue words alphabetically', () => {
    const progress = { zulu: due('2026-10-01'), alpha: due('2026-10-01') }
    expect(buildSession(TODAY, progress, ['zulu', 'alpha']).map((i) => i.word)).toEqual(['alpha', 'zulu'])
  })

  it('skips progress entries for words no longer in the word list', () => {
    const progress = { removed: due('2026-10-01') }
    expect(buildSession(TODAY, progress, ['alpha'], 5)).toEqual([{ word: 'alpha', kind: 'new' }])
  })

  it('serves words named like inherited object properties as new', () => {
    expect(buildSession(TODAY, {}, ['constructor'])).toEqual([{ word: 'constructor', kind: 'new' }])
  })

  it('returns fewer items when the word list runs out', () => {
    expect(buildSession(TODAY, {}, ['alpha', 'bravo'])).toHaveLength(2)
  })
})
