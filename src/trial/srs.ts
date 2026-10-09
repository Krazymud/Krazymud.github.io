import { addDays } from './day'

export type Grade = 'again' | 'ok' | 'good'

export interface WordProgress {
  interval: number
  due: string
  lastResult: Grade
  seenCount: number
}

export const MASTERED_INTERVAL = 30

const FLOOR: Record<Grade, number> = { again: 1, ok: 3, good: 7 }

export function nextProgress(prev: WordProgress | undefined, grade: Grade, today: string): WordProgress {
  const previous = prev?.interval ?? 0
  const interval = grade === 'again' ? FLOOR.again : Math.max(FLOOR[grade], previous * 2)
  return {
    interval,
    due: addDays(today, interval),
    lastResult: grade,
    seenCount: (prev?.seenCount ?? 0) + 1,
  }
}

export function isMastered(p: WordProgress): boolean {
  return p.interval >= MASTERED_INTERVAL
}
