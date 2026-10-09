import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import { usePageVisible } from '../hooks'
import { CAMERA_FOV, POSES } from '../poses'
import type { StageProps } from '../types'
import { CameraRig } from './CameraRig'
import { Car } from './Car'
import { Floor } from './Floor'
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

  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={visible || deterministic ? 'always' : 'never'}
      camera={{ fov: CAMERA_FOV, near: 0.1, far: 150, position: pose.camera }}
      gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: deterministic }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (event) => {
          event.preventDefault()
          onFail('webgl-context-lost')
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
    </Canvas>
  )
}
