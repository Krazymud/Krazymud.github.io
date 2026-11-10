// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { DEFAULT_BOOK_TITLE, makeBookCoverBitmap, makeLeatherBumpBitmap, resolveBookTitle } from './bookCoverTex'

describe('makeLeatherBumpBitmap', () => {
  it('returns a square bump canvas with painted pixels', () => {
    const out = makeLeatherBumpBitmap()
    expect(out.width).toBe(out.height)
    expect(out.width).toBeGreaterThanOrEqual(256)
    const ctx = out.getContext('2d')!
    const data = ctx.getImageData(40, 40, 1, 1).data
    expect(data[3]).toBe(255)
    expect(data[0]).toBeGreaterThan(0)
  })
})

describe('makeBookCoverBitmap', () => {
  it('paints title and byline on a portrait canvas', () => {
    const out = makeBookCoverBitmap({ title: '远行', byline: '暗房' })
    expect(out.width).toBeGreaterThan(400)
    expect(out.height).toBeGreaterThan(out.width)
    const ctx = out.getContext('2d')!
    const mid = ctx.getImageData(out.width / 2, Math.floor(out.height * 0.38), 1, 1).data
    expect(mid[3]).toBeGreaterThan(0)
  })
})

describe('resolveBookTitle', () => {
  it('prefers trimmed note title over default', () => {
    expect(resolveBookTitle({ noteTitle: '  我们的路  ' })).toBe('我们的路')
    expect(resolveBookTitle({ noteTitle: '' })).toBe(DEFAULT_BOOK_TITLE)
    expect(resolveBookTitle({})).toBe(DEFAULT_BOOK_TITLE)
  })
})
