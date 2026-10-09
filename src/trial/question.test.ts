import { describe, expect, it } from 'vitest'
import { buildQuestion, pickDistractors, type Rng } from './question'
import type { Word } from './types'

function seeded(seed: number): Rng {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const word = (w: string, pos: string, m: string): Word => ({ w, p: '', pos, m })

const target = word('ambiguous', 'adj.', 'adj. 不明确的')
const pool: Word[] = [
  target,
  word('ample', 'adj.', 'adj. 充足的'),
  word('anonymous', 'adj.', 'adj. 匿名的'),
  word('ambitious', 'adj.', 'adj. 有雄心的'),
  word('vague', 'adj.', 'adj. 不明确的'),
  word('abandon', 'v.', 'v. 放弃'),
  word('record', 'n.', 'n. 记录'),
]

describe('pickDistractors', () => {
  it('prefers words with the same part of speech', () => {
    const picked = pickDistractors(target, pool, seeded(1))
    expect(picked).toHaveLength(3)
    expect(picked.every((w) => w.pos === 'adj.')).toBe(true)
  })

  it('never includes the answer or a word with the same meaning', () => {
    for (let seed = 0; seed < 20; seed++) {
      const picked = pickDistractors(target, pool, seeded(seed))
      expect(picked.map((w) => w.w)).not.toContain('ambiguous')
      expect(picked.map((w) => w.w)).not.toContain('vague')
    }
  })

  it('falls back to other parts of speech when needed', () => {
    const small = [target, word('ample', 'adj.', 'adj. 充足的'), word('abandon', 'v.', 'v. 放弃'), word('record', 'n.', 'n. 记录')]
    const picked = pickDistractors(target, small, seeded(3))
    expect(picked.map((w) => w.w).sort()).toEqual(['abandon', 'ample', 'record'])
  })
})

describe('buildQuestion', () => {
  it('always asks new words English to Chinese', () => {
    for (let seed = 0; seed < 10; seed++) {
      expect(buildQuestion(target, 'new', pool, seeded(seed)).direction).toBe('en2zh')
    }
  })

  it('asks review words in either direction', () => {
    const directions = new Set(Array.from({ length: 30 }, (_, seed) => buildQuestion(target, 'review', pool, seeded(seed)).direction))
    expect(directions).toEqual(new Set(['en2zh', 'zh2en']))
  })

  it('places the answer at answerIndex among four options', () => {
    const q = buildQuestion(target, 'new', pool, seeded(7))
    expect(q.options).toHaveLength(4)
    expect(q.options[q.answerIndex]).toBe(target)
  })
})
