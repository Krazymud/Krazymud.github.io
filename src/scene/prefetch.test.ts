import { afterEach, describe, expect, it, vi } from 'vitest'
import { assetUrl, CAR_URL, downloadAll, onPrefetchProgress, prefetchStageAssets, resetPrefetch, STAGE_ASSETS, takeEarlyFetch } from './prefetch'
import { EARLY_FETCHES } from './stageAssets'

function streamed(chunks: number[], length: number | null): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const size of chunks) controller.enqueue(new Uint8Array(size))
      controller.close()
    },
  })
  return new Response(body, { headers: length === null ? {} : { 'content-length': String(length) } })
}

describe('downloadAll', () => {
  it('reports progress by bytes once every file has announced its size', async () => {
    const seen: number[] = []
    const files = await downloadAll(['/a', '/b'], (fraction) => seen.push(fraction), async (url) =>
      url === '/a' ? streamed([30, 70], 100) : streamed([100, 200], 300),
    )
    expect(seen[0]).toBeLessThan(1)
    expect(seen.at(-1)).toBe(1)
    expect([...seen].sort((x, y) => x - y)).toEqual(seen)
    expect(files.get('/b')?.size).toBe(300)
  })

  it('caps a compressed file at its announced size', async () => {
    const seen: number[] = []
    await downloadAll(['/glb'], (fraction) => seen.push(fraction), async () => streamed([80, 80], 100))
    expect(Math.max(...seen)).toBe(1)
    expect(seen.filter((fraction) => fraction > 1)).toEqual([])
  })

  it('fails when a file is missing', async () => {
    await expect(downloadAll(['/x'], () => {}, async () => new Response(null, { status: 404 }))).rejects.toThrow('404')
  })
})

describe('prefetchStageAssets', () => {
  afterEach(() => resetPrefetch())

  it('hands the loaders local copies of the garage assets', async () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:car')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const fetcher = vi.fn(async () => streamed([10], 10))
    const seen: number[] = []
    const off = onPrefetchProgress((fraction) => seen.push(fraction))
    await prefetchStageAssets(fetcher)
    await prefetchStageAssets(fetcher)
    expect(fetcher).toHaveBeenCalledTimes(STAGE_ASSETS.length)
    expect(assetUrl(CAR_URL)).toBe('blob:car')
    expect(seen.at(-1)).toBe(1)
    off()
    create.mockRestore()
  })

  it('takes over the downloads the page head already started', async () => {
    const early = Promise.resolve(streamed([10], 10))
    ;(window as unknown as Record<string, unknown>)[EARLY_FETCHES] = { [CAR_URL]: early }
    const fetcher = vi.fn(async () => streamed([10], 10))
    vi.stubGlobal('fetch', fetcher)
    expect(takeEarlyFetch(CAR_URL)).toBe(early)
    await takeEarlyFetch(CAR_URL)
    expect(fetcher).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('falls back to the plain addresses when the download fails', async () => {
    await prefetchStageAssets(async () => {
      throw new TypeError('offline')
    })
    expect(assetUrl(CAR_URL)).toBe(CAR_URL)
  })
})
