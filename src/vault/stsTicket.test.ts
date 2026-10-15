import { describe, expect, it, vi } from 'vitest'
import { fetchStsTicket, ticketValid } from './stsTicket'

describe('fetchStsTicket', () => {
  it('returns temp creds on 200', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        secretId: 'a',
        secretKey: 'b',
        sessionToken: 'c',
        startTime: 1,
        expiredTime: 1000,
      }),
    )
    const creds = await fetchStsTicket({
      fetch: fetchImpl as unknown as typeof fetch,
      issuerUrl: 'https://example.com/sts',
      gate: 'secret',
    })
    expect(creds.sessionToken).toBe('c')
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/sts',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})

describe('ticketValid', () => {
  it('rejects tickets inside the skew window', () => {
    expect(ticketValid({ secretId: '', secretKey: '', expiredTime: 500 }, 400, 120)).toBe(false)
    expect(ticketValid({ secretId: '', secretKey: '', expiredTime: 600 }, 400, 120)).toBe(true)
  })
})
