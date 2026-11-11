import { describe, expect, it, vi } from 'vitest'
import { isOptionalUpload, putWithRetries, remoteMatchesLocal, uploadOrder } from './sync-cos-site.ts'

describe('putWithRetries', () => {
  it('retries UserNetworkTooSlow then succeeds', async () => {
    const put = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => '<Code>UserNetworkTooSlow</Code>',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => '',
      })

    await putWithRetries(put, 'site/fonts/x.woff2', { retries: 3, delayMs: 0 })
    expect(put).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting retries', async () => {
    const put = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => '<Code>UserNetworkTooSlow</Code>',
    })

    await expect(putWithRetries(put, 'site/fonts/x.woff2', { retries: 2, delayMs: 0 })).rejects.toThrow(
      /UserNetworkTooSlow/,
    )
    expect(put).toHaveBeenCalledTimes(2)
  })

  it('retries thrown fetch failures then succeeds', async () => {
    const put = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => '',
      })

    await putWithRetries(put, 'site/fonts/x.woff2', { retries: 3, delayMs: 0 })
    expect(put).toHaveBeenCalledTimes(2)
  })
})

describe('isOptionalUpload', () => {
  it('marks fonts/vault/music optional and HTML/assets required', () => {
    expect(isOptionalUpload('fonts/lxgw-wenkai-regular.woff2')).toBe(true)
    expect(isOptionalUpload('vault/blobs/abc.bin')).toBe(true)
    expect(isOptionalUpload('darkroom/music/satie-gymnopedie-1.mp3')).toBe(true)
    expect(isOptionalUpload('assets/index-abc.js')).toBe(false)
    expect(isOptionalUpload('index.html')).toBe(false)
  })
})

describe('uploadOrder', () => {
  it('uploads radio music with assets before HTML and vault', () => {
    const ordered = uploadOrder([
      'vault/blobs/a.bin',
      'index.html',
      'darkroom/music/satie-gymnopedie-1.mp3',
      'assets/index-abc.js',
    ])
    expect(ordered.slice(0, 2)).toEqual(['assets/index-abc.js', 'darkroom/music/satie-gymnopedie-1.mp3'])
    expect(ordered[2]).toBe('index.html')
    expect(ordered[3]).toBe('vault/blobs/a.bin')
  })
})

describe('remoteMatchesLocal', () => {
  it('returns false when HEAD fetch throws (do not abort sync)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'))
    const matched = await remoteMatchesLocal(
      { secretId: 'AKIDtest', secretKey: 'secret' },
      'bucket',
      'ap-shanghai',
      'site/assets/x.js',
      12,
    )
    expect(matched).toBe(false)
    fetchSpy.mockRestore()
  })
})
