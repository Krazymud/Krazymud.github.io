/** Shown when the COS sync gate is wrong or STS/COS returns 401/403. */
export const GATE_DENIED = '同步口令不对'

/** Shown when STS/COS is unreachable (CORS, offline, misconfigured issuer) — not a wrong gate. */
export const SYNC_UNAVAILABLE = '同步连不上，请稍后重试'
