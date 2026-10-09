import type { ItemKind, Word } from './types'

export type Direction = 'en2zh' | 'zh2en'
export type Rng = () => number

export interface Question {
  word: Word
  direction: Direction
  options: Word[]
  answerIndex: number
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function pickDistractors(word: Word, pool: Word[], rng: Rng, count = 3): Word[] {
  const candidates = pool.filter((c) => c.w !== word.w && c.m !== word.m)
  const samePos = shuffle(candidates.filter((c) => c.pos === word.pos), rng)
  const otherPos = shuffle(candidates.filter((c) => c.pos !== word.pos), rng)
  const meanings = new Set([word.m])
  const picked: Word[] = []
  for (const candidate of [...samePos, ...otherPos]) {
    if (picked.length >= count) break
    if (meanings.has(candidate.m)) continue
    meanings.add(candidate.m)
    picked.push(candidate)
  }
  return picked
}

export function buildQuestion(word: Word, kind: ItemKind, pool: Word[], rng: Rng): Question {
  const direction: Direction = kind === 'review' && rng() < 0.5 ? 'zh2en' : 'en2zh'
  const options = shuffle([word, ...pickDistractors(word, pool, rng)], rng)
  return { word, direction, options, answerIndex: options.indexOf(word) }
}
