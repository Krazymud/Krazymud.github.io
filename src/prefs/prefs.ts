import { useSyncExternalStore } from 'react'

export const PREFS_KEY = 'midnight-garage/prefs'

export interface Prefs {
  scene3d: boolean
  muted: boolean
  introSeen: boolean
}

export const DEFAULT_PREFS: Prefs = { scene3d: true, muted: false, introSeen: false }

export function readPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_PREFS }
    const record = parsed as Record<string, unknown>
    const pick = (key: keyof Prefs): boolean => {
      const value = record[key]
      return typeof value === 'boolean' ? value : DEFAULT_PREFS[key]
    }
    return { scene3d: pick('scene3d'), muted: pick('muted'), introSeen: pick('introSeen') }
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
  const next = { ...previous }
  for (const key of PREF_KEYS) next[key] = patch[key] ?? previous[key]
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
