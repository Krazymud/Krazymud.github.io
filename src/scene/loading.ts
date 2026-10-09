import { useSyncExternalStore } from 'react'

export type LoadingKind = '3d' | 'still'

export interface Loading {
  kind: LoadingKind
  fraction: number
}

export const CHUNK_SHARE = 0.3

const INITIAL: Loading = { kind: '3d', fraction: 0 }
let state: Loading = INITIAL
const listeners = new Set<() => void>()

export function stageProgress(chunkLoaded: boolean, assets: number): number {
  if (!chunkLoaded) return 0
  return CHUNK_SHARE + (1 - CHUNK_SHARE) * Math.min(Math.max(assets, 0), 1)
}

export function getLoading(): Loading {
  return state
}

export function setLoading(next: Loading): void {
  if (next.kind === state.kind && next.fraction === state.fraction) return
  state = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useLoading(): Loading {
  return useSyncExternalStore(subscribe, getLoading, getLoading)
}

export function resetLoading(): void {
  setLoading(INITIAL)
}
