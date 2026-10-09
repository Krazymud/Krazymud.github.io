import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useLayoutEffect, useRef, useState } from 'react'
import { dprFor, type Quality } from '../frameGuard'
import { usePageVisible } from '../hooks'
import { CAMERA_FOV, POSES } from '../poses'
import type { StageProps } from '../types'
import { CameraRig } from './CameraRig'
import { Car } from './Car'
import { Floor } from './Floor'
import { FrameGuard } from './FrameGuard'
import { PostFx } from './PostFx'
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

export function Stage({ scene, onReady, onFail, deterministic = false }: StageProps) {
  const pose = POSES[scene]
  const visible = usePageVisible()
  const [quality, setQuality] = useState<Quality>(0)
  const mounted = useRef(false)
  const latestOnFail = useRef(onFail)

  useLayoutEffect(() => {
    latestOnFail.current = onFail
  })

  // R3F forces a context loss while disposing the renderer, after this component is gone.
  useLayoutEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  return (
    <Canvas
      dpr={dprFor(quality)}
      frameloop={visible || deterministic ? 'always' : 'never'}
      camera={{ fov: CAMERA_FOV, near: 0.1, far: 150, position: pose.camera }}
      gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: deterministic }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (event) => {
          event.preventDefault()
          if (mounted.current) latestOnFail.current('webgl-context-lost')
        })
      }}
    >
      <color attach="background" args={['#050506']} />
      <fog attach="fog" args={['#050506', 18, 45]} />
      <Studio pose={pose} deterministic={deterministic} />
      <Floor pose={pose} deterministic={deterministic} />
      <CameraRig pose={pose} deterministic={deterministic} />
      <Suspense fallback={null}>
        <Car pose={pose} deterministic={deterministic} />
        <FirstFrame onReady={onReady} />
      </Suspense>
      {quality < 2 && <PostFx deterministic={deterministic} />}
      {!deterministic && <FrameGuard onQuality={setQuality} onGiveUp={() => onFail('slow')} />}
    </Canvas>
  )
}
