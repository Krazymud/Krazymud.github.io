// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  POLAROID_W,
  buildPolaroidZip,
  crc32,
  renderPolaroidBack,
  renderPolaroidFront,
  type PolaroidRenderOpts,
} from './polaroidRender'

function loadTestImage(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 120
  c.height = 160
  const x = c.getContext('2d')!
  x.fillStyle = '#6a8b52'
  x.fillRect(0, 0, c.width, c.height)
  x.fillStyle = '#e8dcc8'
  x.fillRect(24, 20, 72, 96)
  return c
}

const baseOpts = (partial?: Partial<PolaroidRenderOpts>): PolaroidRenderOpts => ({
  caption: '海边一行字',
  date: '2024-06-01',
  index: 0,
  rollLabel: '暗房',
  ...partial,
})

describe('renderPolaroidFront', () => {
  it('front canvas is larger than photo inset', async () => {
    const img = loadTestImage()
    const c = await renderPolaroidFront(img, baseOpts({ caption: 'hi', index: 0 }))
    expect(c.width).toBeGreaterThan(400)
    expect(c.height).toBeGreaterThan(c.width * 1.5)
    expect(c.width).toBe(POLAROID_W)
  })

  it('paints non-transparent photo region', async () => {
    const img = loadTestImage()
    const c = await renderPolaroidFront(img, baseOpts())
    const x = c.getContext('2d')!
    const insetX = 4 * 16 + 40
    const insetY = 6 * 16 + 40
    const px = x.getImageData(insetX, insetY, 1, 1).data
    expect(px[3]).toBe(255)
    expect(px[0] + px[1] + px[2]).toBeGreaterThan(0)
  })
})

describe('renderPolaroidBack', () => {
  it('matches front outer dimensions', async () => {
    const c = await renderPolaroidBack(baseOpts({ caption: '背面说明文字' }))
    expect(c.width).toBe(POLAROID_W)
    expect(c.height).toBeGreaterThan(400)
  })
})

describe('buildPolaroidZip', () => {
  it('emits local-file-header signature', async () => {
    const data = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00])
    const blob = buildPolaroidZip([{ name: 'polaroid-01-front.jpg', data }])
    const buf = new Uint8Array(await blob.arrayBuffer())
    expect(buf[0]).toBe(0x50)
    expect(buf[1]).toBe(0x4b)
    expect(buf[2]).toBe(0x03)
    expect(buf[3]).toBe(0x04)
    expect(blob.type).toBe('application/zip')
  })

  it('crc32 matches stored entry', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5])
    expect(crc32(data)).toBe(crc32(data))
    expect(crc32(data)).toBe(0x470b99f4)
  })
})
