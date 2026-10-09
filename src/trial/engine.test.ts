import { describe, expect, it } from 'vitest'
import { emptyProgress, type ProgressData } from '../progress/store'
import {
  currentItem,
  dueOn,
  ensureSession,
  isFinished,
  MAX_ANSWER_GAP_MS,
  masteredCount,
  recordAnswer,
  skipItem,
} from './engine'

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
      { day: TODAY, total: 3, correct: 2, newCount: 3, reviewCount: 0, bestCombo: 1, durationMs: 59000 },
    ])
  })

  it('starts the lap timer at the first answer', () => {
    const data = recordAnswer(started(), 'good', 5_000_000)
    expect(data.session).toMatchObject({ activeMs: 0, lastAnswerAt: 5_000_000 })
  })

  it('accumulates the gaps between answers', () => {
    let data = recordAnswer(started(), 'good', 2000)
    data = recordAnswer(data, 'ok', 5000)
    expect(data.session).toMatchObject({ activeMs: 3000, lastAnswerAt: 5000 })
  })

  it('caps each gap at MAX_ANSWER_GAP_MS', () => {
    let data = recordAnswer(started(), 'good', 2000)
    data = recordAnswer(data, 'ok', 2000 + 3_600_000)
    expect(MAX_ANSWER_GAP_MS).toBe(60_000)
    expect(data.session?.activeMs).toBe(60_000)
  })

  it('ignores negative gaps from clock changes', () => {
    let data = recordAnswer(started(), 'good', 9000)
    data = recordAnswer(data, 'ok', 4000)
    expect(data.session).toMatchObject({ activeMs: 0, lastAnswerAt: 4000 })
  })

  it('records the active time as the day stat duration', () => {
    let data = started()
    data = recordAnswer(data, 'good', 10_000_000)
    data = recordAnswer(data, 'ok', 10_004_000)
    data = recordAnswer(data, 'ok', 10_500_000)
    expect(data.session?.activeMs).toBe(64_000)
    expect(data.history[0].durationMs).toBe(64_000)
  })

  it('records zero duration for a single-question session', () => {
    let data = ensureSession(emptyProgress(), TODAY, ['alpha'], 1000)
    data = recordAnswer(data, 'good', 9_000_000)
    expect(data.history[0].durationMs).toBe(0)
  })

  it('ignores answers after the session is finished', () => {
    let data = started()
    for (const grade of ['ok', 'ok', 'ok'] as const) data = recordAnswer(data, grade, 2000)
    expect(recordAnswer(data, 'good', 3000)).toBe(data)
  })
})

describe('skipItem', () => {
  it('drops the current word from the session without grading it', () => {
    const data = skipItem(recordAnswer(started(), 'good', 2000), 'bravo', 2500)
    expect(data.words).not.toHaveProperty('bravo')
    expect(data.session?.items.map((i) => i.word)).toEqual(['alpha', 'charlie'])
    expect(data.session).toMatchObject({ cursor: 1, correct: 1, combo: 1 })
    expect(currentItem(data.session)).toEqual({ word: 'charlie', kind: 'new' })
  })

  it('ignores a word that is not the current one', () => {
    const data = started()
    expect(skipItem(data, 'charlie', 2000)).toBe(data)
  })

  it('finishes the session when the last word is skipped', () => {
    let data = recordAnswer(started(), 'good', 2000)
    data = recordAnswer(data, 'ok', 3000)
    data = skipItem(data, 'charlie', 4000)
    expect(isFinished(data.session!)).toBe(true)
    expect(data.session?.finishedAt).toBe(4000)
    expect(data.history).toEqual([
      { day: TODAY, total: 2, correct: 2, newCount: 2, reviewCount: 0, bestCombo: 2, durationMs: 1000 },
    ])
  })

  it('records no day stat when every word was skipped', () => {
    let data = ensureSession(emptyProgress(), TODAY, ['alpha'], 1000)
    data = skipItem(data, 'alpha', 2000)
    expect(isFinished(data.session!)).toBe(true)
    expect(data.history).toEqual([])
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
