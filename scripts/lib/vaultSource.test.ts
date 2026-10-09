// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  checkConfigRefs,
  isHeicFile,
  isPhotoFile,
  parseConfig,
  parseList,
  parseNote,
  sha256Hex,
  sortLists,
  VaultError,
} from './vaultSource.ts'

describe('photo file names', () => {
  it('accepts common formats case-insensitively', () => {
    expect(['a.jpg', 'b.JPEG', 'c.png', 'd.webp', 'e.HEIC', 'f.heif'].every(isPhotoFile)).toBe(true)
    expect(isPhotoFile('g.gif')).toBe(false)
    expect(isHeicFile('IMG_1.HEIC')).toBe(true)
    expect(isHeicFile('a.jpg')).toBe(false)
  })
})

describe('parseNote', () => {
  it('reads title, date and body, tolerating Windows line endings', () => {
    const text = '---\r\ntitle: 晚安\r\ndate: 2024-05-21\r\n---\r\n\r\n今天的风很温柔。\r\n'
    expect(parseNote('notes/a.md', text)).toEqual({ title: '晚安', date: '2024-05-21', body: '今天的风很温柔。' })
  })

  it('explains what is missing', () => {
    expect(() => parseNote('notes/a.md', '---\ndate: 2024-05-21\n---\nhi')).toThrow(new VaultError('notes/a.md：缺少 title'))
    expect(() => parseNote('notes/a.md', '---\ntitle: hi\ndate: 5月21日\n---\nhi')).toThrow(
      'notes/a.md：date 必须是 YYYY-MM-DD 格式',
    )
    expect(() => parseNote('notes/a.md', 'no front matter')).toThrow('notes/a.md：缺少 title')
  })
})

describe('parseList', () => {
  it('reads checked and unchecked items and ignores other lines', () => {
    const text = '---\ntitle: 一起去的地方\n---\n- [x] 去看海\n- [ ] 去冰岛看极光\n* [X] 吃火锅\n随便写的一行\n'
    expect(parseList('lists/a.md', text)).toEqual({
      title: '一起去的地方',
      items: [
        { text: '去看海', done: true },
        { text: '去冰岛看极光', done: false },
        { text: '吃火锅', done: true },
      ],
    })
  })

  it('rejects a list without items', () => {
    expect(() => parseList('lists/a.md', '---\ntitle: 空\n---\n')).toThrow('lists/a.md：没有找到「- [ ] 事项」这样的清单行')
  })
})

describe('parseConfig', () => {
  it('returns defaults without a manifest', () => {
    expect(parseConfig(null)).toEqual({ photos: {}, listOrder: [] })
  })

  it('reads photo captions, dates and the list order', () => {
    const text = 'photos:\n  IMG_0001.jpg:\n    caption: 第一次去海边\n    date: 2024-05-20\nlists:\n  order: [b.md, a.md]\n'
    expect(parseConfig(text)).toEqual({
      photos: { 'IMG_0001.jpg': { caption: '第一次去海边', date: '2024-05-20' } },
      listOrder: ['b.md', 'a.md'],
    })
  })

  it('rejects invalid YAML and bad dates', () => {
    expect(() => parseConfig('photos: [')).toThrow('manifest.yaml 不是有效的 YAML')
    expect(() => parseConfig('photos:\n  a.jpg:\n    date: yesterday\n')).toThrow(
      'manifest.yaml 里的 a.jpg：date 必须是 YYYY-MM-DD 格式',
    )
  })
})

describe('checkConfigRefs', () => {
  it('rejects references to files that do not exist', () => {
    const config = parseConfig('photos:\n  gone.jpg:\n    caption: x\n')
    expect(() => checkConfigRefs(config, ['a.jpg'], [])).toThrow('manifest.yaml 提到了不存在的照片：gone.jpg')
    expect(() => checkConfigRefs({ photos: {}, listOrder: ['x.md'] }, [], ['a.md'])).toThrow(
      'manifest.yaml 提到了不存在的清单：x.md',
    )
  })

  it('rejects a list named twice in lists.order', () => {
    expect(() => checkConfigRefs({ photos: {}, listOrder: ['a.md', 'b.md', 'a.md'] }, [], ['a.md', 'b.md'])).toThrow(
      new VaultError('manifest.yaml 的 lists.order 里重复写了清单：a.md'),
    )
  })
})

describe('dates', () => {
  const note = (date: string) => parseNote('notes/a.md', `---\ntitle: hi\ndate: ${date}\n---\nhi`)

  it('rejects dates that do not exist', () => {
    expect(() => note('2024-13-45')).toThrow('notes/a.md：date 必须是 YYYY-MM-DD 格式')
    expect(() => note('2023-02-29')).toThrow('notes/a.md：date 必须是 YYYY-MM-DD 格式')
    expect(() => parseConfig('photos:\n  a.jpg:\n    date: 2024-02-30\n')).toThrow(
      'manifest.yaml 里的 a.jpg：date 必须是 YYYY-MM-DD 格式',
    )
  })

  it('accepts a leap day', () => {
    expect(note('2024-02-29').date).toBe('2024-02-29')
  })
})

describe('sortLists', () => {
  it('puts ordered lists first, then the rest by name', () => {
    expect(sortLists(['c.md', 'a.md', 'b.md'], ['b.md'])).toEqual(['b.md', 'a.md', 'c.md'])
  })
})

describe('sha256Hex', () => {
  it('hashes text and bytes the same way', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(sha256Hex(new TextEncoder().encode('abc'))).toBe(sha256Hex('abc'))
  })
})
