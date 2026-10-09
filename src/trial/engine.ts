import type { DaySession, DayStat, ProgressData } from '../progress/store'
import { buildSession, DAILY_LIMIT } from './session'
import { isMastered, nextProgress, type Grade, type WordProgress } from './srs'
import type { SessionItem } from './types'

export function ensureSession(
  data: ProgressData,
  today: string,
  order: string[],
  now: number,
  limit = DAILY_LIMIT,
): ProgressData {
  if (data.session?.day === today) return data
  const session: DaySession = {
    day: today,
    items: buildSession(today, data.words, order, limit),
    cursor: 0,
    correct: 0,
    combo: 0,
    bestCombo: 0,
    startedAt: now,
  }
  return { ...data, session }
}

export function currentItem(session: DaySession | undefined): SessionItem | undefined {
  if (!session || isFinished(session)) return undefined
  return session.items[session.cursor]
}

export function isFinished(session: DaySession): boolean {
  return session.finishedAt !== undefined || session.cursor >= session.items.length
}

function toStat(session: DaySession, finishedAt: number): DayStat {
  const newCount = session.items.filter((item) => item.kind === 'new').length
  return {
    day: session.day,
    total: session.items.length,
    correct: session.correct,
    newCount,
    reviewCount: session.items.length - newCount,
    bestCombo: session.bestCombo,
    durationMs: finishedAt - session.startedAt,
  }
}

export function recordAnswer(data: ProgressData, grade: Grade, now: number): ProgressData {
  const session = data.session
  const item = currentItem(session)
  if (!session || !item) return data

  const correct = grade !== 'again'
  const combo = correct ? session.combo + 1 : 0
  const next: DaySession = {
    ...session,
    cursor: session.cursor + 1,
    correct: session.correct + (correct ? 1 : 0),
    combo,
    bestCombo: Math.max(session.bestCombo, combo),
  }
  const words = { ...data.words, [item.word]: nextProgress(data.words[item.word], grade, session.day) }

  if (next.cursor < next.items.length) return { ...data, words, session: next }
  next.finishedAt = now
  return { ...data, words, session: next, history: [...data.history, toStat(next, now)] }
}

export function dueOn(words: Readonly<Record<string, WordProgress>>, day: string): number {
  return Object.values(words).filter((p) => p.due <= day).length
}

export function masteredCount(words: Readonly<Record<string, WordProgress>>): number {
  return Object.values(words).filter(isMastered).length
}
