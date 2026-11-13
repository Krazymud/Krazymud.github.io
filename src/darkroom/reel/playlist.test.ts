import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { DEFAULT_PLAYLIST, SHELL_SONG_TITLES, type PlaylistTrack } from './playlist'

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

  it('pairs each src with the shell Chinese titles', () => {
    expect(DEFAULT_PLAYLIST[0]).toMatchObject({
      src: '/darkroom/music/satie-gymnopedie-1.mp3',
      title: SHELL_SONG_TITLES.satie,
    })
    expect(DEFAULT_PLAYLIST[1]).toMatchObject({
      src: '/darkroom/music/chopin-nocturne-op37-1.mp3',
      title: SHELL_SONG_TITLES.chopin,
    })
    expect(DEFAULT_PLAYLIST[2]).toMatchObject({
      src: '/darkroom/music/debussy-clair-de-lune.mp3',
      title: SHELL_SONG_TITLES.debussy,
    })
  })

  it('matches reel-shell MUSIC titles in index.html', async () => {
    const html = await readFile(path.join(process.cwd(), 'public/reel-shell/index.html'), 'utf8')
    expect(html).toContain(SHELL_SONG_TITLES.satie)
    expect(html).toContain(SHELL_SONG_TITLES.debussy)
    expect(html).toContain(SHELL_SONG_TITLES.chopin)
  })
})
