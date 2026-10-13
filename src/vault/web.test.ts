import { describe, expect, it } from 'vitest'
import { generateDek } from './crypto'
import {
  deleteWebNote,
  emptyWebDoc,
  isRealDate,
  localCalendarToday,
  mergeWebDocs,
  openWebFile,
  publishedItemDone,
  saveWebList,
  saveWebNote,
  sealWebFile,
  togglePublishedCheck,
  toggleWebListItem,
  WebFileError,
  type WebClock,
  type WebDoc,
  type WebList,
  type WebNote,
} from './web'

function clock(now: number, ids: string[] = []): WebClock {
  let index = 0
  return {
    now: () => now,
    uuid: () => {
      const id = ids[index]
      if (id === undefined) throw new Error('uuid exhausted')
      index += 1
      return id
    },
    today: () => '2026-10-13',
  }
}

const note = (id: string, updatedAt: number, title = id): WebNote => ({
  id,
  title,
  date: '2026-10-13',
  body: '',
  updatedAt,
})

const list = (id: string, updatedAt: number, items: WebList['items']): WebList => ({
  id,
  title: id,
  items,
  updatedAt,
})

describe('web document', () => {
  it('starts empty', () => {
    expect(emptyWebDoc()).toEqual({ notes: [], lists: [], checks: {}, tombstones: { notes: [], lists: [] } })
    expect(emptyWebDoc()).not.toBe(emptyWebDoc())
  })

  it('accepts a real calendar date and rejects an impossible one', () => {
    expect(isRealDate('2026-10-13')).toBe(true)
    expect(isRealDate('2024-02-29')).toBe(true)
    expect(isRealDate('2026-02-31')).toBe(false)
    expect(isRealDate('2026-13-01')).toBe(false)
    expect(isRealDate('2026-1-01')).toBe(false)
    expect(localCalendarToday(new Date(2026, 9, 13, 3, 30))).toBe('2026-10-13')
  })

  it('saves, edits, and deletes a note, and a newer edit beats an older tombstone', () => {
    const created = saveWebNote(emptyWebDoc(), { title: '  晚安  ', date: '2026-10-13', body: '' }, clock(10, ['n1']))
    expect(created).toEqual({ ok: true, doc: { ...emptyWebDoc(), notes: [note('n1', 10, '晚安')] } })
    const saved = (created as { ok: true; doc: WebDoc }).doc
    const edited = saveWebNote(saved, { id: 'n1', title: '早晨', date: '2026-10-14', body: '正文' }, clock(20))
    expect(edited.ok).toBe(true)
    if (!edited.ok) return
    expect(edited.doc.notes).toEqual([{ id: 'n1', title: '早晨', date: '2026-10-14', body: '正文', updatedAt: 20 }])

    const deleted = deleteWebNote(edited.doc, 'n1', 30)
    expect(deleted.notes).toEqual([])
    expect(deleted.tombstones.notes).toEqual([{ id: 'n1', updatedAt: 30 }])

    const revived = saveWebNote(deleted, { id: 'n1', title: '又写了', date: '2026-10-13', body: '' }, clock(40))
    expect(revived.ok).toBe(true)
    if (!revived.ok) return
    expect(revived.doc.notes.map((item) => item.id)).toEqual(['n1'])
    expect(revived.doc.tombstones.notes).toEqual([])
  })

  it('rejects a blank title or an impossible date and does not spend an id', () => {
    const ids = clock(10, ['unused'])
    expect(saveWebNote(emptyWebDoc(), { title: '   ', date: '2026-10-13', body: 'x' }, ids)).toEqual({
      ok: false,
      reason: 'title',
    })
    expect(saveWebNote(emptyWebDoc(), { title: '标题', date: '2026-02-31', body: '' }, ids)).toEqual({
      ok: false,
      reason: 'date',
    })
    expect(ids.uuid()).toBe('unused')
  })

  it('replaces a web list wholesale, drops blank items, and checks an item on the list', () => {
    const created = saveWebList(
      emptyWebDoc(),
      { title: ' 买菜 ', items: [{ text: '   ', done: false }, { text: ' 牛奶 ', done: false }] },
      clock(10, ['item-1', 'list-1']),
    )
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(created.doc.lists).toEqual([
      { id: 'list-1', title: '买菜', items: [{ id: 'item-1', text: '牛奶', done: false }], updatedAt: 10 },
    ])

    const emptyItems = saveWebList(created.doc, { id: 'list-1', title: '空的', items: [] }, clock(15))
    expect(emptyItems.ok).toBe(true)
    if (!emptyItems.ok) return
    expect(emptyItems.doc.lists[0]).toMatchObject({ title: '空的', items: [], updatedAt: 15 })

    const withItem = saveWebList(
      emptyItems.doc,
      { id: 'list-1', title: '买菜', items: [{ id: 'item-1', text: '牛奶', done: false }] },
      clock(16),
    )
    if (!withItem.ok) return
    const checked = toggleWebListItem(withItem.doc, 'list-1', 'item-1', 20)
    expect(checked.lists[0]).toMatchObject({
      updatedAt: 20,
      items: [{ id: 'item-1', text: '牛奶', done: true }],
    })
    expect(toggleWebListItem(checked, 'missing', 'item-1', 99)).toBe(checked)
  })

  it('merges by updatedAt and keeps base on a tie', () => {
    const base: WebDoc = {
      ...emptyWebDoc(),
      notes: [note('same', 5, 'base'), note('only-base', 1, '留下')],
      lists: [list('same-list', 5, [{ id: 'old', text: '旧', done: false }])],
      checks: { 'lists/a.md': { '0': { done: false, updatedAt: 5 } } },
      tombstones: { notes: [{ id: 'gone', updatedAt: 8 }], lists: [] },
    }
    const incoming: WebDoc = {
      ...emptyWebDoc(),
      notes: [note('same', 5, 'incoming'), note('only-incoming', 2, '新的')],
      lists: [list('same-list', 9, [{ id: 'new', text: '新', done: true }])],
      checks: {
        'lists/a.md': { '0': { done: true, updatedAt: 5 }, '1': { done: true, updatedAt: 6 } },
        'lists/b.md': { '0': { done: true, updatedAt: 1 } },
      },
      tombstones: { notes: [], lists: [] },
    }
    const merged = mergeWebDocs(base, incoming)
    expect(merged.notes.map((item) => item.title).sort()).toEqual(['base', '新的', '留下'])
    expect(merged.lists[0].items).toEqual([{ id: 'new', text: '新', done: true }])
    expect(merged.checks['lists/a.md']['0']).toEqual({ done: false, updatedAt: 5 })
    expect(merged.checks['lists/a.md']['1']).toEqual({ done: true, updatedAt: 6 })
    expect(merged.checks['lists/b.md']['0'].done).toBe(true)
    expect(merged.tombstones.notes).toEqual([{ id: 'gone', updatedAt: 8 }])
  })

  it('lets the newer tombstone or the newer record win', () => {
    const base = deleteWebNote(
      (saveWebNote(emptyWebDoc(), { title: '旧', date: '2026-10-13', body: '' }, clock(1, ['n1'])) as { ok: true; doc: WebDoc }).doc,
      'n1',
      5,
    )
    const olderEdit = saveWebNote(emptyWebDoc(), { id: 'n1', title: '更旧的编辑', date: '2026-10-13', body: '' }, clock(4))
    if (!olderEdit.ok) return
    expect(mergeWebDocs(base, olderEdit.doc).notes).toEqual([])
    expect(mergeWebDocs(base, olderEdit.doc).tombstones.notes).toEqual([{ id: 'n1', updatedAt: 5 }])

    const newerEdit = saveWebNote(emptyWebDoc(), { id: 'n1', title: '更新的编辑', date: '2026-10-13', body: '' }, clock(9))
    if (!newerEdit.ok) return
    const won = mergeWebDocs(base, newerEdit.doc)
    expect(won.notes.map((item) => item.title)).toEqual(['更新的编辑'])
    expect(won.tombstones.notes).toEqual([])
  })

  it('overlays an in-range published check and ignores a stale index', () => {
    const doc = togglePublishedCheck(emptyWebDoc(), 'lists/a.md', 0, false, 12)
    expect(doc.checks['lists/a.md']['0']).toEqual({ done: false, updatedAt: 12 })
    expect(publishedItemDone(doc, 'lists/a.md', 0, 2, true)).toBe(false)
    expect(publishedItemDone(doc, 'lists/a.md', 1, 2, true)).toBe(true)
    const stale = togglePublishedCheck(doc, 'lists/a.md', 4, true, 20)
    expect(publishedItemDone(stale, 'lists/a.md', 4, 2, false)).toBe(false)
  })

  it('seals a version 1 file and refuses another version or another key', async () => {
    const dek = await generateDek()
    const other = await generateDek()
    const text = await sealWebFile(dek, emptyWebDoc())
    expect(JSON.parse(text)).toMatchObject({ version: 1 })
    expect(await openWebFile(dek, text)).toEqual(emptyWebDoc())
    await expect(openWebFile(other, text)).rejects.toBeInstanceOf(WebFileError)
    await expect(openWebFile(dek, JSON.stringify({ version: 2, sealed: 'x' }))).rejects.toThrow('网页上的笔记打不开')
  })
})
