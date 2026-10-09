import { describe, expect, it, vi } from 'vitest'
import type { Word, WordIndex } from './types'
import { chunkName, createWordSource, type FetchJson } from './wordsRepo'

const word = (w: string): Word => ({ w, p: '', pos: 'n.', m: `n. ${w}` })

const INDEX: WordIndex = { version: 1, chunkSize: 2, words: ['a', 'b', 'c', 'd', 'e'] }
const CHUNKS: Record<string, Word[]> = {
  'chunk-000.json': [word('a'), word('b')],
  'chunk-001.json': [word('c'), word('d')],
  'chunk-002.json': [word('e')],
}

function fakeFetch(failOnce?: string) {
  let failed = false
  return vi.fn(async (url: string) => {
    const name = url.split('/').pop()!
    if (name === failOnce && !failed) {
      failed = true
      throw new Error('network')
    }
    if (name === 'index.json') return INDEX
    return CHUNKS[name]
  }) as unknown as FetchJson & ReturnType<typeof vi.fn>
}

describe('chunkName', () => {
  it('pads chunk ids to three digits', () => {
    expect(chunkName(7)).toBe('chunk-007.json')
  })
})

describe('createWordSource', () => {
  it('exposes the word order from the index', async () => {
    const source = await createWordSource(fakeFetch())
    expect(source.order).toEqual(INDEX.words)
  })

  it('resolves words with their chunk as the distractor pool', async () => {
    const source = await createWordSource(fakeFetch())
    const result = await source.lookup(['a', 'd'])
    expect(result.get('a')).toEqual({ word: word('a'), pool: CHUNKS['chunk-000.json'] })
    expect(result.get('d')).toEqual({ word: word('d'), pool: CHUNKS['chunk-001.json'] })
    expect(result.has('b')).toBe(false)
  })

  it('loads each chunk only once', async () => {
    const fetchJson = fakeFetch()
    const source = await createWordSource(fetchJson)
    await source.lookup(['a'])
    await source.lookup(['b'])
    expect(fetchJson.mock.calls.filter(([url]) => String(url).endsWith('chunk-000.json'))).toHaveLength(1)
  })

  it('retries a chunk that failed to load', async () => {
    const source = await createWordSource(fakeFetch('chunk-002.json'))
    await expect(source.lookup(['e'])).rejects.toThrow('network')
    expect((await source.lookup(['e'])).get('e')?.word).toEqual(word('e'))
  })
})
