import type { Word, WordIndex } from './types'

export interface ResolvedWord {
  word: Word
  pool: Word[]
}

export interface WordSource {
  order: string[]
  lookup(words: string[]): Promise<Map<string, ResolvedWord>>
}

export type FetchJson = <T>(url: string) => Promise<T>

const BASE = `${import.meta.env.BASE_URL}words/`

const fetchJsonOverHttp: FetchJson = async <T>(url: string) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return (await response.json()) as T
}

export function chunkName(id: number): string {
  return `chunk-${String(id).padStart(3, '0')}.json`
}

export async function createWordSource(fetchJson: FetchJson = fetchJsonOverHttp): Promise<WordSource> {
  const index = await fetchJson<WordIndex>(`${BASE}index.json`)
  const position = new Map(index.words.map((w, i) => [w, i]))
  const chunks = new Map<number, Promise<Word[]>>()

  function loadChunk(id: number): Promise<Word[]> {
    const cached = chunks.get(id)
    if (cached) return cached
    const pending = fetchJson<Word[]>(`${BASE}${chunkName(id)}`)
    pending.catch(() => chunks.delete(id))
    chunks.set(id, pending)
    return pending
  }

  return {
    order: index.words,
    async lookup(words) {
      const wanted = new Set(words)
      const ids = new Set<number>()
      for (const w of wanted) {
        const pos = position.get(w)
        if (pos !== undefined) ids.add(Math.floor(pos / index.chunkSize))
      }
      const pools = await Promise.all([...ids].map(loadChunk))
      const result = new Map<string, ResolvedWord>()
      for (const pool of pools) {
        for (const word of pool) {
          if (wanted.has(word.w)) result.set(word.w, { word, pool })
        }
      }
      return result
    },
  }
}
