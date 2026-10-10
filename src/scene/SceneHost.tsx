import { useCallback, useEffect, useState, type ComponentType } from 'react'
import { perfMark } from '../perf/perf'
import { usePrefs } from '../prefs/prefs'
import { usePrefersReducedMotion } from './hooks'
import { setLoading, stageProgress } from './loading'
import { onPrefetchProgress, prefetchStageAssets } from './prefetch'
import { markSceneFailed, sceneFailed, sceneMode, supportsWebGL2 } from './mode'
import { POSES } from './poses'
import { SceneErrorBoundary } from './SceneErrorBoundary'
import { Still } from './Still'
import type { Scene, StageModule, StageProps } from './types'
import { useAmbience } from './useAmbience'

export const FADE_MS = 600

const loadDefaultStage = (): Promise<StageModule> => import('./three/Stage')

type Prefetch = (onProgress: (fraction: number) => void) => Promise<void>

const prefetchDefault: Prefetch = (onProgress) => {
  const off = onPrefetchProgress(onProgress)
  return prefetchStageAssets().finally(off)
}

interface SceneHostProps {
  scene: Scene
  loadStage?: () => Promise<StageModule>
  prefetch?: Prefetch
  webgl2?: () => boolean
}

export function SceneHost({ scene, loadStage = loadDefaultStage, prefetch = prefetchDefault, webgl2 = supportsWebGL2 }: SceneHostProps) {
  const pose = POSES[scene]
  const ambience = useAmbience()
  const reducedMotion = usePrefersReducedMotion()
  const { scene3d } = usePrefs()
  const [hasWebGL2] = useState(webgl2)
  const [failed, setFailed] = useState(sceneFailed)
  const mode = sceneMode({ reducedMotion, webgl2: hasWebGL2, enabled: scene3d, failed })
  const [Stage, setStage] = useState<ComponentType<StageProps> | null>(null)
  const [codeLoaded, setCodeLoaded] = useState(false)
  const [ready, setReady] = useState(false)
  const [stillGone, setStillGone] = useState(false)
  const [assets, setAssets] = useState(0)
  const reportProgress = useCallback((fraction: number) => {
    if (fraction >= 1) perfMark('素材下载完')
    setAssets((current) => Math.max(current, fraction))
  }, [])

  useEffect(() => {
    setLoading(mode === '3d' ? { kind: '3d', fraction: ready ? 1 : stageProgress(codeLoaded, assets) } : { kind: 'still', fraction: 1 })
  }, [mode, codeLoaded, assets, ready])

  const fail = useCallback(() => {
    markSceneFailed()
    setFailed(true)
  }, [])
  const markReady = useCallback(() => {
    perfMark('首帧画出')
    setReady(true)
  }, [])

  useEffect(() => {
    if (mode !== '3d' || Stage !== null) return
    let alive = true
    perfMark('开始加载 3D')
    const fetched = prefetch((fraction) => {
      if (alive) setAssets((current) => Math.max(current, fraction))
    })
    const code = loadStage().then((module) => {
      perfMark('3D 代码到达')
      if (alive) setCodeLoaded(true)
      return module
    })
    Promise.all([code, fetched]).then(
      ([module]) => {
        if (alive) setStage(() => module.Stage)
      },
      () => {
        if (alive) fail()
      },
    )
    return () => {
      alive = false
    }
  }, [mode, Stage, loadStage, prefetch, fail])

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
        data-testid="scene-tint"
        className="absolute inset-0 mix-blend-soft-light transition-opacity duration-[1200ms] ease-out"
        style={{ backgroundColor: ambience.tint, opacity: showStage && ready ? 0 : ambience.tintAlpha * pose.room }}
      />
      <div
        data-testid="scene-dim"
        className="absolute inset-0 bg-black transition-opacity duration-[1200ms] ease-out"
        style={{ opacity: pose.dim }}
      />
    </div>
  )
}
