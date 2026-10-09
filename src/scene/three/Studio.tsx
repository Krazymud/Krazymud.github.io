import { Environment, Lightformer } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, type Mesh, type SpotLight } from 'three'
import { dampFactor, STILL_SWEEP_X, sweepX, TRANSITION_LAMBDA } from '../motion'
import type { Pose } from '../poses'

interface StudioProps {
  pose: Pose
  deterministic: boolean
}

export function Studio({ pose, deterministic }: StudioProps) {
  const key = useRef<SpotLight>(null)
  const sweep = useRef<Mesh>(null)
  const goal = useMemo(() => new Color(), [])

  useFrame(({ clock }, delta) => {
    goal.set(pose.light)
    if (key.current) {
      if (deterministic) key.current.color.copy(goal)
      else key.current.color.lerp(goal, dampFactor(TRANSITION_LAMBDA, Math.min(delta, 0.1)))
    }
    if (sweep.current) {
      const x = pose.sweep ? (deterministic ? STILL_SWEEP_X : sweepX(clock.elapsedTime)) : null
      sweep.current.visible = x !== null
      if (x !== null) sweep.current.position.x = x
    }
  })

  return (
    <>
      <spotLight ref={key} position={[3, 7, 4]} angle={0.55} penumbra={1} intensity={150} decay={2} color={pose.light} />
      <Environment frames={deterministic ? 1 : Infinity} resolution={128}>
        <Lightformer form="rect" intensity={3} color="#ffffff" position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 1.2, 1]} />
        <Lightformer form="rect" intensity={2} color="#ffffff" position={[0, 6, -3]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 0.6, 1]} />
        <Lightformer form="rect" intensity={2} color="#ffffff" position={[0, 6, 3]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 0.6, 1]} />
        <Lightformer form="rect" intensity={1.5} color="#ffffff" position={[-8, 2.5, 0]} rotation={[0, Math.PI / 2, 0]} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={1.5} color="#ffffff" position={[8, 2.5, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={1.5} color="#ffffff" position={[0, 2.5, -8]} rotation={[0, 0, 0]} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={1.5} color="#ffffff" position={[0, 2.5, 8]} rotation={[0, Math.PI, 0]} scale={[10, 3, 1]} />
        <Lightformer ref={sweep} form="rect" intensity={4} color="#C1272D" position={[0, 4, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.8, 14, 1]} />
      </Environment>
    </>
  )
}
