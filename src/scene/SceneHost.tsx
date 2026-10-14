import { useEffect } from 'react'
import { setLoading } from './loading'
import { SketchStage } from './SketchStage'
import type { Scene } from './types'

export const FADE_MS = 600

interface SceneHostProps {
  scene: Scene
}

export function SceneHost({ scene }: SceneHostProps) {
  useEffect(() => {
    setLoading({ kind: 'still', fraction: 1 })
  }, [])
  const playLoop = scene === 'garage'
  return <SketchStage playLoop={playLoop} />
}
