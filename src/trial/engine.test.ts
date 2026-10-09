import { describe, expect, it } from 'vitest'
import { emptyProgress, type ProgressData } from '../progress/store'
import { currentItem, dueOn, ensureSession, isFinished, masteredCount, recordAnswer } from './engine'

const TODAY = '2026-10-09'
const ORDER = ['alpha', 'bravo', 'charlie']

function started(): ProgressData {
  return ensureSession(emptyProgress(), TODAY, ORDER, 1000)
}

describe('ensureSession', () => {
  it('creates today\'s session from the word order', () => {
    const data = started()
    expect(data.session).toMatchObject({ day: TODAY, cursor: 0, correct: 0, combo: 0, bestCombo: 0, startedAt: 1000 })
    expect(data.session?.items.map((i) => i.word)).toEqual(ORDER)
  })

  it('returns the same object when today\'s session already exists', () => {
    const data = started()
    expect(ensureSession(data, TODAY, ORDER, 5000)).toBe(data)
  })

  it('replaces a session from an earlier day', () => {
    const next = ensureSession(started(), '2026-10-10', ORDER, 9000)
    expect(next.session).toMatchObject({ day: '2026-10-10', startedAt: 9000 })
  })
})

describe('recordAnswer', () => {
  it('grades the current word, advances and builds the combo', () => {
    const data = recordAnswer(started(), 'good', 2000)
    expect(data.words.alpha).toEqual({ interval: 7, due: '2026-10-16', lastResult: 'good', seenCount: 1 })
    expect(data.session).toMatchObject({ cursor: 1, correct: 1, combo: 1, bestCombo: 1 })
    expect(currentItem(data.session)).toEqual({ word: 'bravo', kind: 'new' })
  })

  it('resets the combo on a wrong answer but keeps the best combo', () => {
    let data = recordAnswer(started(), 'ok', 2000)
    data = recordAnswer(data, 'again', 3000)
    expect(data.session).toMatchObject({ cursor: 2, correct: 1, combo: 0, bestCombo: 1 })
    expect(data.words.bravo).toMatchObject({ interval: 1, due: '2026-10-10' })
  })

  it('finishes the session and records a day stat', () => {
    let data = started()
    data = recordAnswer(data, 'good', 2000)
    data = recordAnswer(data, 'again', 3000)
    data = recordAnswer(data, 'ok', 61000)
    expect(data.session?.finishedAt).toBe(61000)
    expect(isFinished(data.session!)).toBe(true)
    expect(data.history).toEqual([
      { day: TODAY, total: 3, correct: 2, newCount: 3, reviewCount: 0, bestCombo: 1, durationMs: 60000 },
    ])
  })

  it('ignores answers after the session is finished', () => {
    let data = started()
    for (const grade of ['ok', 'ok', 'ok'] as const) data = recordAnswer(data, grade, 2000)
    expect(recordAnswer(data, 'good', 3000)).toBe(data)
  })
})

describe('stats', () => {
  const words = {
    alpha: { interval: 1, due: '2026-10-09', lastResult: 'again', seenCount: 1 },
    bravo: { interval: 3, due: '2026-10-10', lastResult: 'ok', seenCount: 1 },
    charlie: { interval: 32, due: '2026-11-10', lastResult: 'good', seenCount: 4 },
  } as const

  it('counts words due on or before a day', () => {
    expect(dueOn(words, '2026-10-09')).toBe(1)
    expect(dueOn(words, '2026-10-10')).toBe(2)
  })

  it('counts mastered words', () => {
    expect(masteredCount(words)).toBe(1)
  })

  it('treats an empty session as finished', () => {
    const data = ensureSession(emptyProgress(), TODAY, [], 1000)
    expect(isFinished(data.session!)).toBe(true)
  })
})
