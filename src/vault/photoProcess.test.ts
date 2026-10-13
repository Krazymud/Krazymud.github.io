import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('exifr', () => ({
  default: {
    parse: vi.fn(),
  },
}))

import exifr from 'exifr'
import { PHOTO_FULL_MAX_EDGE, PhotoProcessError, processVaultPhoto } from './photoProcess'

const TINY_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49,
  0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00,
  0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
])

function mockCanvasPipeline() {
  const mockCtx = {
    drawImage: vi.fn(),
    putImageData: vi.fn(),
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high' as const,
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => mockCtx as unknown as CanvasRenderingContext2D,
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb, type) => {
    cb!(new Blob([new Uint8Array([1, 2, 3, 4])], { type: type ?? 'image/webp' }))
  })
}

describe('processVaultPhoto', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('rejects when heic decoding fails', async () => {
    mockCanvasPipeline()
    const file = new File([new Uint8Array([0, 0, 0])], 'IMG.HEIC', { type: 'image/heic' })
    await expect(
      processVaultPhoto(file, {
        decodeHeic: async () => {
          throw new Error('boom')
        },
      }),
    ).rejects.toBeInstanceOf(PhotoProcessError)
  })

  it('builds webp full and thumb from a decoded bitmap path', async () => {
    vi.mocked(exifr.parse).mockResolvedValue(undefined)
    mockCanvasPipeline()
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({
        width: 2400,
        height: 1800,
        close: vi.fn(),
      })),
    )

    const file = new File([TINY_PNG], 'photo.png', { type: 'image/png' })
    const now = new Date(2026, 9, 13, 3, 30)
    const result = await processVaultPhoto(file, { now })

    expect(result.width).toBeLessThanOrEqual(PHOTO_FULL_MAX_EDGE)
    expect(result.height).toBeLessThanOrEqual(PHOTO_FULL_MAX_EDGE)
    expect(result.full).toBeInstanceOf(Uint8Array)
    expect(result.thumb).toBeInstanceOf(Uint8Array)
    expect(result.full.byteLength).toBeGreaterThan(0)
    expect(result.thumb.byteLength).toBeGreaterThan(0)
    expect(result).toMatchObject({ width: 2000, height: 1500, date: '2026-10-13' })
  })
})
