import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, studyDay } from './day'

describe('studyDay', () => {
  it('counts times before 04:00 as the previous day', () => {
    expect(studyDay(new Date(2026, 9, 9, 3, 59))).toBe('2026-10-08')
  })

  it('starts the new day at 04:00', () => {
    expect(studyDay(new Date(2026, 9, 9, 4, 0))).toBe('2026-10-09')
  })

  it('handles the first of the month before 04:00', () => {
    expect(studyDay(new Date(2026, 10, 1, 1, 0))).toBe('2026-10-31')
  })
})

describe('addDays', () => {
  it('crosses year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('supports negative offsets', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('daysBetween', () => {
  it('returns whole days between two study days', () => {
    expect(daysBetween('2026-10-09', '2026-10-16')).toBe(7)
    expect(daysBetween('2026-10-16', '2026-10-09')).toBe(-7)
  })
})
