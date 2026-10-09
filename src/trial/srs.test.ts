import { describe, expect, it } from 'vitest'
import { isMastered, nextProgress, type WordProgress } from './srs'

const TODAY = '2026-10-09'

function progress(interval: number): WordProgress {
  return { interval, due: TODAY, lastResult: 'ok', seenCount: 2 }
}

describe('nextProgress', () => {
  it('schedules a new word by grade: again 1, ok 3, good 7 days', () => {
    expect(nextProgress(undefined, 'again', TODAY)).toEqual({ interval: 1, due: '2026-10-10', lastResult: 'again', seenCount: 1 })
    expect(nextProgress(undefined, 'ok', TODAY)).toEqual({ interval: 3, due: '2026-10-12', lastResult: 'ok', seenCount: 1 })
    expect(nextProgress(undefined, 'good', TODAY)).toEqual({ interval: 7, due: '2026-10-16', lastResult: 'good', seenCount: 1 })
  })

  it('doubles the interval on later correct answers', () => {
    expect(nextProgress(progress(7), 'ok', TODAY).interval).toBe(14)
    expect(nextProgress(progress(14), 'good', TODAY).interval).toBe(28)
  })

  it('never drops below the grade floor when doubling', () => {
    expect(nextProgress(progress(3), 'good', TODAY).interval).toBe(7)
    expect(nextProgress(progress(1), 'ok', TODAY).interval).toBe(3)
  })

  it('resets to 1 day on again regardless of history', () => {
    expect(nextProgress(progress(40), 'again', TODAY)).toMatchObject({ interval: 1, due: '2026-10-10' })
  })

  it('increments seenCount', () => {
    expect(nextProgress(progress(3), 'ok', TODAY).seenCount).toBe(3)
  })
})

describe('isMastered', () => {
  it('treats interval of 30 days or more as mastered', () => {
    expect(isMastered(progress(30))).toBe(true)
    expect(isMastered(progress(29))).toBe(false)
  })
})
