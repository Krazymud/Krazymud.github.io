import { describe, expect, it } from 'vitest'
import { FILM_FRAME_PITCH, filmLengthForFrames } from './FilmPull'

describe('filmLengthForFrames', () => {
  it('grows with frame count', () => {
    expect(filmLengthForFrames(8)).toBeGreaterThan(filmLengthForFrames(4))
  })

  it('scales linearly per frame pitch', () => {
    expect(filmLengthForFrames(4)).toBeCloseTo(4 * FILM_FRAME_PITCH + FILM_FRAME_PITCH * 0.5, 6)
  })

  it('returns a minimum length for empty rolls', () => {
    expect(filmLengthForFrames(0)).toBe(FILM_FRAME_PITCH * 2)
  })
})
