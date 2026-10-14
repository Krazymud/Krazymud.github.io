import { useSyncExternalStore } from 'react'
import { PREFS_KEY } from './key'

export { PREFS_KEY }

export interface Prefs {
  muted: boolean
}

export const DEFAULT_PREFS: Prefs = {
  muted: false,
}

export function readPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_PREFS }
    const record = parsed as Record<string, unknown>
    return {
      muted: typeof record.muted === 'boolean' ? record.muted : DEFAULT_PREFS.muted,
    }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

function writePrefs(prefs: Prefs) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // 存不下时只在本次访问生效
  }
}

let current: Prefs | null = null
const listeners = new Set<() => void>()

export function getPrefs(): Prefs {
  current ??= readPrefs()
  return current
}

const PREF_KEYS = Object.keys(DEFAULT_PREFS) as (keyof Prefs)[]

export function setPrefs(patch: Partial<Prefs>): void {
  const previous = getPrefs()
  const next: Prefs = { ...previous }
  for (const key of PREF_KEYS) {
    const value = patch[key]
    if (value !== undefined) Object.assign(next, { [key]: value })
  }
  if (PREF_KEYS.every((key) => next[key] === previous[key])) return
  current = next
  writePrefs(current)
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribe, getPrefs, getPrefs)
}

export function resetPrefsCache(): void {
  current = null
}
