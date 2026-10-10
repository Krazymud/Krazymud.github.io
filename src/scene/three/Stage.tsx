import { useProgress } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { perfMark, perfQuality } from '../../perf/perf'
import { NIGHT } from '../ambience'
import { dprFor, startQuality, type Quality } from '../frameGuard'
import { fxFor } from '../fxTiers'
import { usePageVisible } from '../hooks'
import { CAMERA_FOV, POSES } from '../poses'
import type { StageProps } from '../types'
import { useAmbience } from '../useAmbience'
import { Atmosphere } from './Atmosphere'
import { CameraRig } from './CameraRig'
import { Car } from './Car'
import { Floor } from './Floor'
import { FrameGuard } from './FrameGuard'
import { PostFx } from './PostFx'
import { Room } from './Room'
import { Studio } from './Studio'

const coarsePointer = () => typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches

function FirstFrame({ onReady }: { onReady: () => void }) {
  const done = useRef(false)
  useFrame(() => {
    if (done.current) return
    done.current = true
    perfMark('首帧开始渲染')
    requestAnimationFrame(() => onReady())
  })
  return null
}

// Loaders update the progress store while other components suspend mid-render, so report from a microtask instead.
function ReportProgress({ onProgress }: { onProgress: (fraction: number) => void }) {
  useEffect(() => {
    let active = true
    const report = (progress: number) =>
      queueMicrotask(() => {
        if (active) onProgress(progress / 100)
      })
    report(useProgress.getState().progress)
    const unsubscribe = useProgress.subscribe((state) => report(state.progress))
    return () => {
      active = false
      unsubscribe()
    }
  }, [onProgress])
  return null
}

export function Stage({ scene, onReady, onFail, onProgress, deterministic = false }: StageProps) {
  const pose = POSES[scene]
  const liveAmbience = useAmbience()
  const ambience = deterministic ? NIGHT : liveAmbience
  const visible = usePageVisible()
  const [initialQuality] = useState<Quality>(() => (deterministic ? 0 : startQuality(coarsePointer())))
  const [quality, setQuality] = useState<Quality>(initialQuality)
  const fx = fxFor(quality)
  useEffect(() => perfQuality(quality), [quality])
  const detachContextLoss = useRef<(() => void) | null>(null)
  const latestOnFail = useRef(onFail)

  useLayoutEffect(() => {
    latestOnFail.current = onFail
  })

  // R3F forces a context loss while disposing the renderer, after this component is gone.
  useLayoutEffect(() => () => detachContextLoss.current?.(), [])

  return (
    <Canvas
      dpr={dprFor(quality)}
      frameloop={visible || deterministic ? 'always' : 'never'}
      camera={{ fov: CAMERA_FOV, near: 0.1, far: 150, position: pose.camera }}
      gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: deterministic }}
      onCreated={({ gl }) => {
        const canvas = gl.domElement
        const lost = (event: Event) => {
          event.preventDefault()
          latestOnFail.current('webgl-context-lost')
        }
        canvas.addEventListener('webglcontextlost', lost)
        detachContextLoss.current = () => canvas.removeEventListener('webglcontextlost', lost)
      }}
    >
      <color attach="background" args={['#050506']} />
      <fog attach="fog" args={['#050506', 18, 45]} />
      <Studio pose={pose} ambience={ambience} deterministic={deterministic} />
      {fx.atmosphere && <Atmosphere pose={pose} ambience={ambience} deterministic={deterministic} />}
      <CameraRig pose={pose} deterministic={deterministic} />
      {onProgress && <ReportProgress onProgress={onProgress} />}
      <Suspense fallback={null}>
        <Floor pose={pose} deterministic={deterministic} reflection={fx.reflection} />
        <Room pose={pose} ambience={ambience} deterministic={deterministic} />
        <Car pose={pose} deterministic={deterministic} lampGlow={fx.lampGlow} />
        <FirstFrame onReady={onReady} />
      </Suspense>
      {fx.postFx && <PostFx deterministic={deterministic} fx={fx} />}
      {!deterministic && <FrameGuard initial={initialQuality} onQuality={setQuality} onGiveUp={() => onFail('slow')} />}
    </Canvas>
  )
}
