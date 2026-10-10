import { afterEach, describe, expect, it, vi } from 'vitest'
import { DOOR_DAY_KEY, doorPlayedOn, markDoorPlayed } from './doorDay'

describe('doorDay', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('has not played before anything is saved', () => {
    expect(doorPlayedOn('2026-10-10')).toBe(false)
  })

  it('remembers only the day it played', () => {
    markDoorPlayed('2026-10-10')
    expect(localStorage.getItem(DOOR_DAY_KEY)).toBe('2026-10-10')
    expect(doorPlayedOn('2026-10-10')).toBe(true)
    expect(doorPlayedOn('2026-10-11')).toBe(false)
  })

  it('treats a damaged value as not played', () => {
    localStorage.setItem(DOOR_DAY_KEY, '{oops')
    expect(doorPlayedOn('2026-10-10')).toBe(false)
  })

  it('carries on when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(() => markDoorPlayed('2026-10-10')).not.toThrow()
    expect(doorPlayedOn('2026-10-10')).toBe(false)
  })
})
