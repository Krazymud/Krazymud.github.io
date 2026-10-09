import { useCallback, useEffect, useState, type ComponentType } from 'react'
import { usePrefs } from '../prefs/prefs'
import { usePrefersReducedMotion } from './hooks'
import { setLoading, stageProgress } from './loading'
import { markSceneFailed, sceneFailed, sceneMode, supportsWebGL2 } from './mode'
import { POSES } from './poses'
import { SceneErrorBoundary } from './SceneErrorBoundary'
import { Still } from './Still'
import type { Scene, StageModule, StageProps } from './types'

export const FADE_MS = 600

const loadDefaultStage = (): Promise<StageModule> => import('./three/Stage')

function whenIdle(callback: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback, { timeout: 1500 })
    return () => window.cancelIdleCallback(id)
  }
  const id = window.setTimeout(callback, 1)
  return () => window.clearTimeout(id)
}

interface SceneHostProps {
  scene: Scene
  loadStage?: () => Promise<StageModule>
  webgl2?: () => boolean
}

export function SceneHost({ scene, loadStage = loadDefaultStage, webgl2 = supportsWebGL2 }: SceneHostProps) {
  const pose = POSES[scene]
  const reducedMotion = usePrefersReducedMotion()
  const { scene3d } = usePrefs()
  const [hasWebGL2] = useState(webgl2)
  const [failed, setFailed] = useState(sceneFailed)
  const mode = sceneMode({ reducedMotion, webgl2: hasWebGL2, enabled: scene3d, failed })
  const [Stage, setStage] = useState<ComponentType<StageProps> | null>(null)
  const [ready, setReady] = useState(false)
  const [stillGone, setStillGone] = useState(false)
  const [assets, setAssets] = useState(0)
  const reportProgress = useCallback((fraction: number) => setAssets((current) => Math.max(current, fraction)), [])

  useEffect(() => {
    setLoading(mode === '3d' ? { kind: '3d', fraction: ready ? 1 : stageProgress(Stage !== null, assets) } : { kind: 'still', fraction: 1 })
  }, [mode, Stage, assets, ready])

  const fail = useCallback(() => {
    markSceneFailed()
    setFailed(true)
  }, [])
  const markReady = useCallback(() => setReady(true), [])

  useEffect(() => {
    if (mode !== '3d' || Stage !== null) return
    let alive = true
    const cancel = whenIdle(() => {
      loadStage().then(
        (module) => {
          if (alive) setStage(() => module.Stage)
        },
        () => {
          if (alive) fail()
        },
      )
    })
    return () => {
      alive = false
      cancel()
    }
  }, [mode, Stage, loadStage, fail])

  useEffect(() => {
    if (mode === '3d') return
    setReady(false)
    setStillGone(false)
    setAssets(0)
  }, [mode])

  useEffect(() => {
    if (!ready) return
    const id = window.setTimeout(() => setStillGone(true), FADE_MS)
    return () => window.clearTimeout(id)
  }, [ready])

  const showStage = mode === '3d' && Stage !== null

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {!(showStage && stillGone) && <Still scene={pose.still} />}
      {showStage && (
        <div
          className="absolute inset-0 transition-opacity ease-out"
          style={{ opacity: ready ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
        >
          <SceneErrorBoundary onError={fail}>
            <Stage scene={scene} onReady={markReady} onFail={fail} onProgress={reportProgress} />
          </SceneErrorBoundary>
        </div>
      )}
      <div
        data-testid="scene-dim"
        className="absolute inset-0 bg-black transition-opacity duration-[1200ms] ease-out"
        style={{ opacity: pose.dim }}
      />
    </div>
  )
}
