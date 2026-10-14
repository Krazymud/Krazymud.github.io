import { useEffect } from 'react'
import { setLoading } from './loading'
import { SketchStage } from './SketchStage'
import type { Scene } from './types'

export const FADE_MS = 600

interface SceneHostProps {
  scene: Scene
}

export function SceneHost(_props: SceneHostProps) {
  useEffect(() => {
    setLoading({ kind: 'still', fraction: 1 })
  }, [])
  return <SketchStage />
}
