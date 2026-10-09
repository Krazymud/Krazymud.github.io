import { useSyncExternalStore } from 'react'

export const PREFS_KEY = 'midnight-garage/prefs'

export interface Prefs {
  scene3d: boolean
}

export const DEFAULT_PREFS: Prefs = { scene3d: true }

export function readPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_PREFS }
    const scene3d = (parsed as Record<string, unknown>).scene3d
    return { scene3d: typeof scene3d === 'boolean' ? scene3d : DEFAULT_PREFS.scene3d }
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

export function setPrefs(patch: Partial<Prefs>): void {
  current = { ...getPrefs(), ...patch }
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
