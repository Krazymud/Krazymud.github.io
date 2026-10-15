import type { CosCreds } from './cosAuth'

export type StsCreds = CosCreds & { expiredTime: number }

export async function fetchStsTicket(options: {
  fetch: typeof fetch
  issuerUrl: string
  gate: string
}): Promise<StsCreds> {
  const { fetch: fetchImpl, issuerUrl, gate } = options
  const res = await fetchImpl(issuerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gate }),
  })
  const data = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    const err = typeof data.error === 'string' ? data.error : 'sts'
    throw new Error(`STS issuer ${res.status}: ${err}`)
  }
  return {
    secretId: String(data.secretId),
    secretKey: String(data.secretKey),
    sessionToken: data.sessionToken != null ? String(data.sessionToken) : undefined,
    expiredTime: Number(data.expiredTime),
  }
}

export function ticketValid(creds: StsCreds, nowSec: number, skewSec?: number): boolean {
  const skew = skewSec ?? 120
  return creds.expiredTime > nowSec + skew
}
