import { describe, expect, it } from 'vitest'
import { emptyProgress, type DayStat, type ProgressData } from '../progress/store'
import { garageStats } from './stats'

function stat(day: string): DayStat {
  return { day, total: 20, correct: 18, newCount: 10, reviewCount: 10, bestCombo: 6, durationMs: 60_000 }
}

function withDays(...days: string[]): ProgressData {
  return { ...emptyProgress(), history: days.map(stat) }
}

describe('garageStats', () => {
  it('is all zeros for a fresh garage', () => {
    expect(garageStats(emptyProgress(), '2026-10-10')).toEqual({
      streak: 0,
      week: [false, false, false, false, false, false, false],
      todayDone: false,
      mastered: 0,
      due: 0,
    })
  })

  it('counts today when the lap is done', () => {
    const stats = garageStats(withDays('2026-10-08', '2026-10-09', '2026-10-10'), '2026-10-10')
    expect(stats.streak).toBe(3)
    expect(stats.todayDone).toBe(true)
  })

  it('keeps the streak alive while today is still open', () => {
    const stats = garageStats(withDays('2026-10-08', '2026-10-09'), '2026-10-10')
    expect(stats.streak).toBe(2)
    expect(stats.todayDone).toBe(false)
  })

  it('drops to zero after a missed day', () => {
    expect(garageStats(withDays('2026-10-07', '2026-10-08'), '2026-10-10').streak).toBe(0)
  })

  it('stops at the first gap', () => {
    expect(garageStats(withDays('2026-10-05', '2026-10-07', '2026-10-08', '2026-10-09'), '2026-10-09').streak).toBe(3)
  })

  it('counts a day with several laps once', () => {
    expect(garageStats(withDays('2026-10-09', '2026-10-09', '2026-10-10'), '2026-10-10').streak).toBe(2)
  })

  it('runs across a month boundary', () => {
    expect(garageStats(withDays('2026-09-29', '2026-09-30', '2026-10-01'), '2026-10-01').streak).toBe(3)
  })

  it('lights the last seven days oldest first', () => {
    const stats = garageStats(withDays('2026-10-04', '2026-10-06', '2026-10-10', '2026-10-01'), '2026-10-10')
    expect(stats.week).toEqual([true, false, true, false, false, false, true])
  })

  it('counts mastered and due words', () => {
    const data: ProgressData = {
      ...emptyProgress(),
      words: {
        a: { interval: 30, due: '2026-11-09', lastResult: 'good', seenCount: 6 },
        b: { interval: 3, due: '2026-10-10', lastResult: 'ok', seenCount: 2 },
        c: { interval: 1, due: '2026-10-09', lastResult: 'again', seenCount: 3 },
      },
    }
    expect(garageStats(data, '2026-10-10')).toMatchObject({ mastered: 1, due: 2 })
  })
})
