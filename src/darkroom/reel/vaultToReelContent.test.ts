import { describe, expect, it } from 'vitest'
import { fitPaperLetter, LETTER_CHAR_BUDGET, vaultToReelContent } from './vaultToReelContent'
import type { PhotoEntry } from '../../vault/types'
import { SHELL_SONG_TITLES } from './playlist'

function photo(partial: Partial<PhotoEntry> & Pick<PhotoEntry, 'hash' | 'date'>): PhotoEntry {
  return {
    caption: partial.caption ?? '',
    date: partial.date,
    width: 100,
    height: 100,
    thumb: `t-${partial.hash}`,
    full: `f-${partial.hash}`,
    source: `s-${partial.hash}`,
    hash: partial.hash,
  }
}

describe('vaultToReelContent', () => {
  it('puts every photo on every roll and names the rolls by play', () => {
    const photos = [
      photo({ hash: 'a', date: '2026-03-01', caption: '海' }),
      photo({ hash: 'b', date: '2026-04-02', caption: '' }),
      photo({ hash: 'c', date: '2026-05-03', caption: '山' }),
    ]
    const urls = Object.fromEntries(photos.map((p) => [p.hash, { photo: `blob:${p.hash}`, thumb: `blob:${p.hash}t`, full: `blob:${p.hash}f` }]))
    const content = vaultToReelContent({
      photos,
      notes: [{ entry: { title: '信', date: '2026-03-01', blob: 'n1', source: 'notes/n1', hash: 'n1' }, text: '你好' }],
      lists: [{ entry: { title: '想做的事', blob: 'l1', source: 'lists/l1', hash: 'l1' }, content: { items: [{ text: '冲一张', done: false }] } }],
      urls,
    })
    expect(content.rolls.map((r) => r.name)).toEqual(['初显', '曝光', '聚焦', '冲洗'])
    for (const roll of content.rolls) {
      expect(roll.frames).toHaveLength(3)
      expect(roll.frames.map((f) => f.line)).toEqual(['海', '', '山'])
    }
    expect(content.rolls[2].frames[0].line).toBe('海')
    expect(content.radio.dj).toBe('Good evening. Brought to you by your love.')
    expect(content.radio.song).toBe(SHELL_SONG_TITLES.satie)
    expect(content.papers.notes[0]).toMatchObject({ source: 'notes/n1', title: '信', body: '你好' })
    expect(content.papers.lists[0].items).toEqual([{ text: '冲一张', done: false }])
    expect(content.names.both).toBe('暗房')
    const creditsJson = JSON.stringify(content.credits)
    expect(creditsJson).not.toContain('Directed by')
    expect(creditsJson).not.toContain('A Roll')
    expect(content.__vault).toBe(true)
    const blob = JSON.stringify(content)
    expect(blob).not.toMatch(/Tong|CCC|u\/[0-9a-f]{8}/)
    expect(content.rolls[0].frames[0].photo).toBe('blob:a')
    expect(content.picks.opening[0].photo).toBe('blob:a')
  })

  it('offers one blank page when notes or lists are empty', () => {
    const content = vaultToReelContent({ photos: [], notes: [], lists: [], urls: {} })
    expect(content.rolls[0].frames).toHaveLength(1)
    expect(content.rolls[0].frames[0].photo).toBe('img/blank-frame.svg')
    expect(content.papers.notes).toEqual([{ source: '', title: '', date: content.since, body: '' }])
    expect(content.papers.lists).toEqual([{ source: '', title: '', items: [] }])
    expect(content.names.both).toBe('暗房')
  })

  it('keeps the scene-03 letter inside one sheet', () => {
    const long = '今天的风很温柔。'.repeat(80)
    expect(fitPaperLetter(long).length).toBeLessThanOrEqual(LETTER_CHAR_BUDGET + 1)
    expect(fitPaperLetter(long).endsWith('…')).toBe(true)
    const content = vaultToReelContent({
      photos: [],
      notes: [{ entry: { title: '长信', date: '2026-01-01', blob: 'n', source: 'n', hash: 'n' }, text: long }],
      lists: [],
      urls: {},
    })
    expect(content.letter.length).toBeLessThanOrEqual(LETTER_CHAR_BUDGET + 1)
    expect(content.letter).toContain('长信')
  })
})
