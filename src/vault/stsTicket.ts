import type { CosCreds } from './cosAuth'
import { GitHubWriteError } from './github'
import { GATE_DENIED } from './vaultErrors'

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
    if (res.status === 401 || res.status === 403) throw new GitHubWriteError(GATE_DENIED)
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
