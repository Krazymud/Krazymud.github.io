import type { Grade, WordProgress } from '../trial/srs'
import type { SessionItem } from '../trial/types'

export const SCHEMA_VERSION = 1
export const STORAGE_KEY = 'midnight-garage/progress'

export interface DaySession {
  day: string
  items: SessionItem[]
  cursor: number
  correct: number
  combo: number
  bestCombo: number
  startedAt: number
  finishedAt?: number
}

export interface DayStat {
  day: string
  total: number
  correct: number
  newCount: number
  reviewCount: number
  bestCombo: number
  durationMs: number
}

export interface ProgressData {
  schemaVersion: number
  words: Record<string, WordProgress>
  session?: DaySession
  history: DayStat[]
}

export type ParseResult = { ok: true; data: ProgressData } | { ok: false; reason: string }

type Migration = (data: Record<string, unknown>) => Record<string, unknown>

// Key N upgrades data from schemaVersion N to N + 1.
const MIGRATIONS: Record<number, Migration> = {}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const GRADES: readonly string[] = ['again', 'ok', 'good'] satisfies Grade[]

function fail(reason: string): ParseResult {
  return { ok: false, reason }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isDay(value: unknown): value is string {
  return typeof value === 'string' && DAY_RE.test(value)
}

function isWordProgress(value: unknown): value is WordProgress {
  return (
    isRecord(value) &&
    isNumber(value.interval) &&
    value.interval >= 0 &&
    isDay(value.due) &&
    typeof value.lastResult === 'string' &&
    GRADES.includes(value.lastResult) &&
    isNumber(value.seenCount)
  )
}

function isSessionItem(value: unknown): value is SessionItem {
  return isRecord(value) && typeof value.word === 'string' && (value.kind === 'new' || value.kind === 'review')
}

function isDaySession(value: unknown): value is DaySession {
  return (
    isRecord(value) &&
    isDay(value.day) &&
    Array.isArray(value.items) &&
    value.items.every(isSessionItem) &&
    isNumber(value.cursor) &&
    isNumber(value.correct) &&
    isNumber(value.combo) &&
    isNumber(value.bestCombo) &&
    isNumber(value.startedAt) &&
    (value.finishedAt === undefined || isNumber(value.finishedAt))
  )
}

function isDayStat(value: unknown): value is DayStat {
  return (
    isRecord(value) &&
    isDay(value.day) &&
    isNumber(value.total) &&
    isNumber(value.correct) &&
    isNumber(value.newCount) &&
    isNumber(value.reviewCount) &&
    isNumber(value.bestCombo) &&
    isNumber(value.durationMs)
  )
}

export function emptyProgress(): ProgressData {
  return { schemaVersion: SCHEMA_VERSION, words: {}, history: [] }
}

export function parseProgress(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return fail('文件不是有效的 JSON')
  }
  if (!isRecord(raw) || !isNumber(raw.schemaVersion)) return fail('文件里没有进度数据')
  if (raw.schemaVersion > SCHEMA_VERSION) return fail('这个进度文件来自更新版本的站点，请先刷新页面再导入')

  let current = raw
  for (let version = raw.schemaVersion; version < SCHEMA_VERSION; version++) {
    const migrate = MIGRATIONS[version]
    if (!migrate) return fail(`无法从版本 ${version} 升级`)
    current = migrate(current)
  }

  const words = current.words
  if (!isRecord(words) || !Object.values(words).every(isWordProgress)) return fail('进度数据已损坏')

  const data: ProgressData = {
    schemaVersion: SCHEMA_VERSION,
    words: words as Record<string, WordProgress>,
    history: Array.isArray(current.history) ? current.history.filter(isDayStat) : [],
  }
  if (isDaySession(current.session)) data.session = current.session
  return { ok: true, data }
}

export function serializeProgress(data: ProgressData): string {
  return JSON.stringify(data)
}

export function getStorage(): Storage | null {
  try {
    const storage = window.localStorage
    const probe = `${STORAGE_KEY}/probe`
    storage.setItem(probe, probe)
    storage.removeItem(probe)
    return storage
  } catch {
    return null
  }
}

export function loadProgress(storage: Storage): ProgressData {
  const raw = storage.getItem(STORAGE_KEY)
  if (raw === null) return emptyProgress()
  const result = parseProgress(raw)
  if (result.ok) return result.data
  try {
    storage.setItem(`${STORAGE_KEY}/corrupt-${Date.now()}`, raw)
  } catch {
    return emptyProgress()
  }
  return emptyProgress()
}

export function saveProgress(storage: Storage, data: ProgressData): boolean {
  try {
    storage.setItem(STORAGE_KEY, serializeProgress(data))
    return true
  } catch {
    return false
  }
}
