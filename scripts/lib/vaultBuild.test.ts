// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { decryptBytes, generateDek, type VaultKey } from '../../src/vault/crypto.ts'
import { buildVault, referencedBlobs, type SourceItem } from './vaultBuild.ts'

const text = (s: string) => new TextEncoder().encode(s)

function photo(source: string, hash: string, date: string, caption = '') {
  const load = vi.fn(async () => ({ full: text(`full ${source}`), thumb: text(`thumb ${source}`), width: 2000, height: 1500 }))
  return { kind: 'photo', source, hash, caption, date, load } satisfies SourceItem
}

const note = {
  kind: 'note',
  source: 'notes/a.md',
  hash: 'n1',
  title: '晚安',
  date: '2024-05-21',
  body: '今天的风很温柔。',
} satisfies SourceItem

const list = {
  kind: 'list',
  source: 'lists/a.md',
  hash: 'l1',
  title: '一起去的地方',
  items: [{ text: '去看海', done: true }],
} satisfies SourceItem

async function open(dek: VaultKey, writes: Map<string, Uint8Array>, name: string) {
  return new TextDecoder().decode(await decryptBytes(dek, writes.get(name)!))
}

describe('buildVault', () => {
  it('encrypts every item on the first build and sorts by date', async () => {
    const dek = await generateDek()
    const items = [photo('photos/old.jpg', 'p1', '2023-01-01'), photo('photos/new.jpg', 'p2', '2024-05-20', '海边'), note, list]
    const { manifest, writes } = await buildVault(items, null, dek)

    expect(writes.size).toBe(6)
    expect(manifest.photos.map((p) => p.source)).toEqual(['photos/new.jpg', 'photos/old.jpg'])
    expect(manifest.photos[0]).toMatchObject({ caption: '海边', date: '2024-05-20', width: 2000, height: 1500, hash: 'p2' })
    expect(await open(dek, writes, manifest.photos[0].thumb)).toBe('thumb photos/new.jpg')
    expect(await open(dek, writes, manifest.photos[0].full)).toBe('full photos/new.jpg')
    expect(manifest.notes[0]).toMatchObject({ title: '晚安', date: '2024-05-21', source: 'notes/a.md', hash: 'n1' })
    expect(await open(dek, writes, manifest.notes[0].blob)).toBe('今天的风很温柔。')
    expect(JSON.parse(await open(dek, writes, manifest.lists[0].blob))).toEqual({ items: [{ text: '去看海', done: true }] })
    expect(referencedBlobs(manifest)).toEqual(new Set(writes.keys()))
  })

  it('reuses unchanged items without reprocessing photos', async () => {
    const dek = await generateDek()
    const first = await buildVault([photo('photos/a.jpg', 'p1', '2024-05-20'), note, list], null, dek)
    const again = photo('photos/a.jpg', 'p1', '2024-05-20', '新说明')
    const second = await buildVault([again, note, list], first.manifest, dek)

    expect(second.writes.size).toBe(0)
    expect(again.load).not.toHaveBeenCalled()
    expect(second.manifest.photos[0]).toMatchObject({
      caption: '新说明',
      thumb: first.manifest.photos[0].thumb,
      full: first.manifest.photos[0].full,
    })
    expect(second.manifest.notes[0].blob).toBe(first.manifest.notes[0].blob)
    expect(second.manifest.lists[0].blob).toBe(first.manifest.lists[0].blob)
  })

  it('re-encrypts changed items and drops removed ones', async () => {
    const dek = await generateDek()
    const first = await buildVault([note, list], null, dek)
    const second = await buildVault([{ ...note, hash: 'n2', body: '改过了' }], first.manifest, dek)

    expect(second.writes.size).toBe(1)
    expect(second.manifest.notes[0].blob).not.toBe(first.manifest.notes[0].blob)
    expect(await open(dek, second.writes, second.manifest.notes[0].blob)).toBe('改过了')
    expect(second.manifest.lists).toEqual([])
    expect(referencedBlobs(second.manifest).has(first.manifest.lists[0].blob)).toBe(false)
  })

  it('reports whether each item was reused', async () => {
    const dek = await generateDek()
    const onItem = vi.fn()
    const first = await buildVault([note], null, dek, onItem)
    await buildVault([note], first.manifest, dek, onItem)
    expect(onItem.mock.calls).toEqual([
      ['notes/a.md', false],
      ['notes/a.md', true],
    ])
  })
})
