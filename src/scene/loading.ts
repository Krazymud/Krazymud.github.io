import { useSyncExternalStore } from 'react'

export type LoadingKind = '3d' | 'still'

export interface Loading {
  kind: LoadingKind
  fraction: number
}

export const CHUNK_SHARE = 0.3
// 资源下载完到第一帧画出之间还要编译着色器，手机上可能要好几秒；只有第一帧画出后才算 100%。
export const ASSETS_DONE = 0.95

const INITIAL: Loading = { kind: '3d', fraction: 0 }
let state: Loading = INITIAL
const listeners = new Set<() => void>()

export function stageProgress(chunkLoaded: boolean, assets: number): number {
  return (chunkLoaded ? CHUNK_SHARE : 0) + (ASSETS_DONE - CHUNK_SHARE) * Math.min(Math.max(assets, 0), 1)
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
