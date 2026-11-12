import { describe, expect, it } from 'vitest'
import { vaultToReelContent } from './vaultToReelContent'
import type { PhotoEntry } from '../../vault/types'

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
  it('builds 4×8 rolls with 暗房 branding and no Tong paths', () => {
    const photos = [photo({ hash: 'a', date: '2026-03-01', caption: '海' }), photo({ hash: 'b', date: '2026-04-02', caption: '山' })]
    const urls = {
      a: { photo: 'blob:a', thumb: 'blob:at', full: 'blob:af' },
      b: { photo: 'blob:b', thumb: 'blob:bt', full: 'blob:bf' },
    }
    const content = vaultToReelContent({
      photos,
      notes: [{ entry: { title: '信', date: '2026-03-01', blob: 'n1', source: 'n1', hash: 'n1' }, text: '你好，暗房' }],
      lists: [
        {
          entry: { title: '想做的事', blob: 'l1', source: 'l1', hash: 'l1' },
          content: { items: [{ text: '冲一张', done: false }] },
        },
      ],
      urls,
    })
    expect(content.names.both).toBe('暗房')
    expect(content.__vault).toBe(true)
    expect(content.rolls).toHaveLength(4)
    expect(content.rolls.every((r) => r.frames.length === 8)).toBe(true)
    expect(content.letter).toContain('你好')
    expect(content.letter).toContain('信')
    expect(content.rolls[0].name).toBe('想做的事')
    expect(content.ticket.back.some((l) => l.includes('冲一张') || l.includes('想做的事'))).toBe(true)
    const blob = JSON.stringify(content)
    expect(blob).not.toMatch(/Tong|CCC|u\/[0-9a-f]{8}/)
    expect(content.rolls[0].frames[0].photo).toBe('blob:a')
    expect(content.picks.opening[0].photo).toBe('blob:a')
  })

  it('pads empty vault with sample img paths', () => {
    const content = vaultToReelContent({ photos: [], notes: [], lists: [], urls: {} })
    expect(content.rolls[0].frames[0].photo).toMatch(/^img\//)
    expect(content.names.both).toBe('暗房')
  })
})
