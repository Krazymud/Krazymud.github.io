import { describe, expect, it } from 'vitest'
import { CASE_OVERRIDES, PHONETIC_FIXES } from './caseOverrides.ts'
import {
  isCetWord,
  isLowercaseWord,
  parseTranslation,
  rankOf,
  toEntry,
  toPackEntry,
  type EcdictRow,
} from './ecdict.ts'

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

describe('isLowercaseWord', () => {
  it.each(['polish', 'x-ray', "o'clock", 'up-to-date'])('accepts %s', (word) => {
    expect(isLowercaseWord(word)).toBe(true)
  })

  it.each(['Polish', 'CORE', 'France', 'i.e.', 'B.C.', 'x--ray', '-ray', "o'", 'ice cream', ''])('rejects %s', (word) => {
    expect(isLowercaseWord(word)).toBe(false)
  })
})

describe('toPackEntry', () => {
  const overrides = {
    Polish: { w: 'polish', pos: 'v.', m: 'v. 擦亮，使完美；n. 上光剂，光泽' },
    FAX: { w: 'fax' },
  }

  it('keeps a lowercase row as is', () => {
    const entry = toPackEntry(row({ word: 'abandon', translation: 'vt. 放弃, 抛弃' }), overrides)
    expect(entry).toEqual({ w: 'abandon', p: '', pos: 'v.', m: 'v. 放弃，抛弃' })
  })

  it('files a listed capitalized row under its lowercase word with the overridden meaning', () => {
    const polish = row({ word: 'Polish', phonetic: "'pәliʃ", translation: 'a. 波兰的\\nvt. 擦亮, 擦去' })
    expect(toPackEntry(polish, overrides)).toEqual({
      w: 'polish',
      p: "'pəliʃ",
      pos: 'v.',
      m: 'v. 擦亮，使完美；n. 上光剂，光泽',
    })
  })

  it('keeps the row meaning when the override has none', () => {
    const fax = row({ word: 'FAX', translation: 'n. 传真\\nvt. 发传真' })
    expect(toPackEntry(fax, overrides)).toEqual({ w: 'fax', p: '', pos: 'n.', m: 'n. 传真；v. 发传真' })
  })

  it('drops capitalized rows that are not listed', () => {
    expect(toPackEntry(row({ word: 'France', translation: 'n. 法国' }), overrides)).toBeNull()
    expect(toPackEntry(row({ word: 'i.e.', translation: 'adv. 也就是' }), overrides)).toBeNull()
  })

  it('uses the curated overrides by default', () => {
    expect(toPackEntry(row({ word: 'Pole', translation: 'n. 波兰人, 极点' }))).toMatchObject({
      w: 'pole',
      pos: 'n.',
      m: 'n. 杆，柱；极，电极',
    })
  })
})

describe('CASE_OVERRIDES', () => {
  it('maps non-lowercase rows to valid lowercase words', () => {
    for (const [word, override] of Object.entries(CASE_OVERRIDES)) {
      expect(isLowercaseWord(word)).toBe(false)
      expect(isLowercaseWord(override.w)).toBe(true)
      expect(override.w).toBe(word.toLowerCase())
    }
  })

  it('keeps meaning labels aligned with their pos when both are set', () => {
    for (const override of Object.values(CASE_OVERRIDES)) {
      if (override.pos !== undefined && override.m !== undefined) {
        expect(override.m.startsWith(override.pos)).toBe(true)
      }
    }
  })
})

describe('parseTranslation', () => {
  it('maps the plural part of speech to n.', () => {
    expect(parseTranslation('pl. 人们, 民族')).toEqual({ pos: 'n.', meaning: 'n. 人们，民族' })
  })

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

  it('replaces ECDICT caret markers with g', () => {
    const entry = toEntry(row({ word: 'god', phonetic: '^ɔd', translation: 'n. 神' }))
    expect(entry?.p).toBe('gɔd')
  })

  it('applies curated phonetic fixes for malformed rows', () => {
    expect(PHONETIC_FIXES.permanently).toBe("'pə:mənəntli")
    const entry = toEntry(
      row({ word: 'permanently', phonetic: "p\\'m\\'n\\'ntli", translation: 'ad. 永久地' }),
    )
    expect(entry?.p).toBe("'pə:mənəntli")
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
