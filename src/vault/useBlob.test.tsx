import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useBlobUrl } from './useBlob'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d])
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])

describe('useBlobUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function capture() {
    const blobs: Blob[] = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobs.push(blob as Blob)
      return `blob:${blobs.length}`
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    return blobs
  }

  it('labels a PNG fallback photo as image/png', async () => {
    const blobs = capture()
    const read = vi.fn(async () => new Uint8Array(PNG))
    const { result } = renderHook(() => useBlobUrl('a', read, 'image/webp'))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(blobs[0].type).toBe('image/png')
  })

  it('keeps the requested type for webp bytes', async () => {
    const blobs = capture()
    const read = vi.fn(async () => new Uint8Array(WEBP))
    const { result } = renderHook(() => useBlobUrl('a', read, 'image/webp'))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(blobs[0].type).toBe('image/webp')
  })
})
