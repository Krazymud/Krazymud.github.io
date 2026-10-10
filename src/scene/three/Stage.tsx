import { useProgress } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NIGHT } from '../ambience'
import { dprFor, type Quality } from '../frameGuard'
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

function FirstFrame({ onReady }: { onReady: () => void }) {
  const done = useRef(false)
  useFrame(() => {
    if (done.current) return
    done.current = true
    requestAnimationFrame(() => onReady())
  })
  return null
}

function ReportProgress({ onProgress }: { onProgress: (fraction: number) => void }) {
  const progress = useProgress((state) => state.progress)
  useEffect(() => {
    onProgress(progress / 100)
  }, [progress, onProgress])
  return null
}

export function Stage({ scene, onReady, onFail, onProgress, deterministic = false }: StageProps) {
  const pose = POSES[scene]
  const liveAmbience = useAmbience()
  const ambience = deterministic ? NIGHT : liveAmbience
  const visible = usePageVisible()
  const [quality, setQuality] = useState<Quality>(0)
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
      {quality < 2 && <Atmosphere pose={pose} ambience={ambience} deterministic={deterministic} />}
      <CameraRig pose={pose} deterministic={deterministic} />
      {onProgress && <ReportProgress onProgress={onProgress} />}
      <Suspense fallback={null}>
        <Floor pose={pose} deterministic={deterministic} />
        <Room pose={pose} ambience={ambience} deterministic={deterministic} />
        <Car pose={pose} deterministic={deterministic} />
        <FirstFrame onReady={onReady} />
      </Suspense>
      {quality < 2 && <PostFx deterministic={deterministic} />}
      {!deterministic && <FrameGuard onQuality={setQuality} onGiveUp={() => onFail('slow')} />}
    </Canvas>
  )
}
