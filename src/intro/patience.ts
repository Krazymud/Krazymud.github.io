import { useState } from 'react'

// 慢网络下只要还在收数据就继续等；卡住不动或等得太久才放弃。
export const STALL_MS = 8000
export const MAX_WAIT_MS = 30000

export function usePatience(fraction: number, startedAt: number, now: number): boolean {
  const [last, setLast] = useState({ fraction, at: startedAt })
  if (fraction > last.fraction) setLast({ fraction, at: now })
  const lastMoved = fraction > last.fraction ? now : last.at
  return now - lastMoved >= STALL_MS || now - startedAt >= MAX_WAIT_MS
}
