// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { makeCanisterLabelBitmap, rollStyle } from './labelTex'

describe('makeCanisterLabelBitmap', () => {
  it('paints title and roll meta', () => {
    const out = makeCanisterLabelBitmap(
      { id: 'a', title: '远行', photoSources: ['x', 'y'] },
      { bg: '#e6d8bd', ink: '#b5301e', band: '#b5301e', iso: '400' },
    )
    expect(out.width).toBe(1024)
    expect(out.height).toBe(512)
    const ctx = out.getContext('2d')!
    const data = ctx.getImageData(512, 40, 1, 1).data
    expect(data[3]).toBeGreaterThan(0)
  })

  it('cycles label styles for roll index', () => {
    const a = rollStyle(0)
    const b = rollStyle(1)
    expect(a.bg).not.toBe(b.bg)
    expect(rollStyle(5)).toEqual(rollStyle(0))
  })
})
