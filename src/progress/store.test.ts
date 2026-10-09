import { beforeEach, describe, expect, it } from 'vitest'
import {
  emptyProgress,
  loadProgress,
  parseProgress,
  saveProgress,
  serializeProgress,
  STORAGE_KEY,
  type ProgressData,
} from './store'

const sample: ProgressData = {
  schemaVersion: 1,
  words: { alpha: { interval: 7, due: '2026-10-16', lastResult: 'good', seenCount: 1 } },
  session: {
    day: '2026-10-09',
    items: [{ word: 'alpha', kind: 'new' }],
    cursor: 1,
    correct: 1,
    combo: 1,
    bestCombo: 1,
    startedAt: 1000,
    finishedAt: 61000,
  },
  history: [{ day: '2026-10-09', total: 1, correct: 1, newCount: 1, reviewCount: 0, bestCombo: 1, durationMs: 60000 }],
}

describe('parseProgress', () => {
  it('round-trips serialized data', () => {
    expect(parseProgress(serializeProgress(sample))).toEqual({ ok: true, data: sample })
  })

  it('rejects text that is not JSON', () => {
    expect(parseProgress('not json')).toEqual({ ok: false, reason: '文件不是有效的 JSON' })
  })

  it('rejects JSON without a schema version', () => {
    expect(parseProgress('{"words":{}}')).toEqual({ ok: false, reason: '文件里没有进度数据' })
  })

  it('rejects files from a newer schema version', () => {
    const result = parseProgress(JSON.stringify({ ...sample, schemaVersion: 2 }))
    expect(result).toEqual({ ok: false, reason: '这个进度文件来自更新版本的站点，请先刷新页面再导入' })
  })

  it('rejects corrupted word entries', () => {
    const broken = { ...sample, words: { alpha: { interval: 'x' } } }
    expect(parseProgress(JSON.stringify(broken))).toEqual({ ok: false, reason: '进度数据已损坏' })
  })

  it('keeps a session without lap timer fields', () => {
    expect(sample.session).not.toHaveProperty('activeMs')
    expect(sample.session).not.toHaveProperty('lastAnswerAt')
    const result = parseProgress(serializeProgress(sample))
    expect(result.ok && result.data.session).toEqual(sample.session)
  })

  it('keeps a session with lap timer fields', () => {
    const session = { ...sample.session!, activeMs: 42000, lastAnswerAt: 61000 }
    const result = parseProgress(JSON.stringify({ ...sample, session }))
    expect(result.ok && result.data.session).toEqual(session)
  })

  it('drops an invalid session but keeps words', () => {
    const result = parseProgress(JSON.stringify({ ...sample, session: { day: 'yesterday' } }))
    expect(result.ok && result.data.session).toBeUndefined()
    expect(result.ok && result.data.words.alpha.interval).toBe(7)
  })

  it.each([
    { cursor: -1 },
    { cursor: 1.5 },
    { cursor: 2 },
    { correct: -1 },
    { combo: 0.5 },
    { bestCombo: -2 },
    { activeMs: -1 },
    { activeMs: 'x' },
    { lastAnswerAt: -5 },
  ])('drops a session with out-of-range counters %o but keeps words', (patch) => {
    const result = parseProgress(JSON.stringify({ ...sample, session: { ...sample.session, ...patch } }))
    expect(result.ok && result.data.session).toBeUndefined()
    expect(result.ok && result.data.words.alpha.interval).toBe(7)
  })
})

describe('loadProgress / saveProgress', () => {
  beforeEach(() => localStorage.clear())

  it('returns empty progress when nothing is stored', () => {
    expect(loadProgress(localStorage)).toEqual(emptyProgress())
  })

  it('loads what was saved', () => {
    expect(saveProgress(localStorage, sample)).toBe(true)
    expect(loadProgress(localStorage)).toEqual(sample)
  })

  it('backs up corrupted data and starts fresh', () => {
    localStorage.setItem(STORAGE_KEY, '{oops')
    expect(loadProgress(localStorage)).toEqual(emptyProgress())
    const backups = Object.keys(localStorage).filter((k) => k.startsWith(`${STORAGE_KEY}/corrupt-`))
    expect(backups).toHaveLength(1)
  })

  it('reports failure when storage throws', () => {
    const full = {
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    } as unknown as Storage
    expect(saveProgress(full, sample)).toBe(false)
  })
})
