import { describe, expect, it } from 'vitest'
import { isCetWord, parseTranslation, rankOf, toEntry, type EcdictRow } from './ecdict.ts'

function row(overrides: Partial<EcdictRow>): EcdictRow {
  return { word: 'x', phonetic: '', translation: '', tag: 'cet4', frq: '0', bnc: '0', ...overrides }
}

describe('isCetWord', () => {
  it('accepts cet4 or cet6 tags only', () => {
    expect(isCetWord('gk cet6 ky')).toBe(true)
    expect(isCetWord('zk gk cet4')).toBe(true)
    expect(isCetWord('zk gk')).toBe(false)
    expect(isCetWord('')).toBe(false)
  })
})

describe('parseTranslation', () => {
  it('normalizes the part of speech and drops domain lines', () => {
    expect(parseTranslation('a. 不明确的, 模棱两可的\\n[法] 意思含糊的, 模棱两可的')).toEqual({
      pos: 'adj.',
      meaning: 'adj. 不明确的，模棱两可的',
    })
  })

  it('keeps at most two senses with three meanings each', () => {
    const t = 'n. 记录, 履历, 档案, 审判记录\\nvt. 记录, 记载, 标明, 将...录音\\nvi. 记录, 录音\\n[计] 录制, 记录'
    expect(parseTranslation(t)).toEqual({ pos: 'n.', meaning: 'n. 记录，履历，档案；v. 记录，记载，标明' })
  })

  it('accepts lines without a part of speech', () => {
    expect(parseTranslation('你好')).toEqual({ pos: '', meaning: '你好' })
  })

  it('returns null when only domain lines remain', () => {
    expect(parseTranslation('[计] 录制')).toBeNull()
  })
})

describe('toEntry', () => {
  it('builds a word entry and normalizes the schwa character', () => {
    const entry = toEntry(row({ word: 'abandon', phonetic: "ә'bændәn", translation: 'vt. 放弃, 抛弃' }))
    expect(entry).toEqual({ w: 'abandon', p: "ə'bændən", pos: 'v.', m: 'v. 放弃，抛弃' })
  })

  it('returns null for rows without a usable meaning', () => {
    expect(toEntry(row({ translation: '[计] 录制' }))).toBeNull()
  })
})

describe('rankOf', () => {
  it('prefers frq, falls back to bnc, otherwise sorts last', () => {
    expect(rankOf(row({ frq: '516', bnc: '507' }))).toBe(516)
    expect(rankOf(row({ frq: '0', bnc: '67' }))).toBe(67)
    expect(rankOf(row({ frq: '', bnc: '0' }))).toBe(Number.POSITIVE_INFINITY)
  })
})
