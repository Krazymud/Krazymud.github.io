import { describe, expect, it, vi } from 'vitest'
import { putWithRetries } from './sync-cos-site.ts'

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
