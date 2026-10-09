import type { ComponentType } from 'react'

export type Scene = 'garage' | 'track' | 'vault' | 'settings'

export type StillScene = 'garage' | 'track' | 'vault'

export interface StageProps {
  scene: Scene
  onReady: () => void
  onFail: (reason: string) => void
  deterministic?: boolean
}

export interface StageModule {
  Stage: ComponentType<StageProps>
}
