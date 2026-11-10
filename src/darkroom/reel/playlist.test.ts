import { describe, expect, it } from 'vitest'
import { DEFAULT_PLAYLIST, type PlaylistTrack } from './playlist'

function assertTrack(t: PlaylistTrack) {
  expect(t.src).toMatch(/^\/darkroom\/music\/[\w-]+\.mp3$/)
  expect(t.title.trim().length).toBeGreaterThan(0)
}

describe('DEFAULT_PLAYLIST', () => {
  it('lists placeholder public-domain wiring tracks', () => {
    expect(DEFAULT_PLAYLIST.length).toBeGreaterThanOrEqual(2)
    DEFAULT_PLAYLIST.forEach(assertTrack)
  })

  it('uses unique src paths', () => {
    const srcs = DEFAULT_PLAYLIST.map((t) => t.src)
    expect(new Set(srcs).size).toBe(srcs.length)
  })
})
