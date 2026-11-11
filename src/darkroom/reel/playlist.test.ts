import { describe, expect, it } from 'vitest'
import { DEFAULT_PLAYLIST, type PlaylistTrack } from './playlist'

function assertTrack(t: PlaylistTrack) {
  expect(t.src).toMatch(/^\/darkroom\/music\/[\w-]+\.mp3$/)
  expect(t.title.trim().length).toBeGreaterThan(0)
}

describe('DEFAULT_PLAYLIST', () => {
  it('lists licensed public-domain piano tracks (not placeholder tones)', () => {
    expect(DEFAULT_PLAYLIST.length).toBeGreaterThanOrEqual(2)
    DEFAULT_PLAYLIST.forEach(assertTrack)
    for (const t of DEFAULT_PLAYLIST) {
      expect(t.src).not.toMatch(/tone-[abc]\.mp3$/)
      expect(t.title).not.toMatch(/测试曲/)
    }
  })

  it('uses unique src paths', () => {
    const srcs = DEFAULT_PLAYLIST.map((t) => t.src)
    expect(new Set(srcs).size).toBe(srcs.length)
  })

  it('points at files that exist under public/', async () => {
    const { access } = await import('node:fs/promises')
    const path = await import('node:path')
    for (const t of DEFAULT_PLAYLIST) {
      const file = path.join(process.cwd(), 'public', t.src.replace(/^\//, ''))
      await expect(access(file)).resolves.toBeUndefined()
    }
  })
})
