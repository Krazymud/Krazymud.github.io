import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, type MeshBasicMaterial } from 'three'
import { dampFactor, TRANSITION_LAMBDA } from '../motion'
import type { Pose } from '../poses'
import { useIgnitionLevel } from './useIgnitionLevel'

export const TURNTABLE_HEIGHT = 0.04
const RADIUS = 2.5
const EDGE_GLOW = 2.2

export function Turntable({ pose, deterministic }: { pose: Pose; deterministic: boolean }) {
  const edge = useRef<MeshBasicMaterial>(null)
  const lights = useIgnitionLevel()
  const goal = useMemo(() => new Color(), [])
  const current = useMemo(() => new Color(pose.light), [])

  useFrame((_, delta) => {
    goal.set(pose.light)
    if (deterministic) current.copy(goal)
    else current.lerp(goal, dampFactor(TRANSITION_LAMBDA, Math.min(delta, 0.1)))
    edge.current?.color.copy(current).multiplyScalar(EDGE_GLOW * lights.current)
  })

  return (
    <group>
      <mesh position={[0, TURNTABLE_HEIGHT / 2, 0]} receiveShadow>
        <cylinderGeometry args={[RADIUS, RADIUS, TURNTABLE_HEIGHT, 96]} />
        <meshStandardMaterial color="#141417" metalness={0.85} roughness={0.38} />
      </mesh>
      <mesh position={[0, TURNTABLE_HEIGHT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[RADIUS - 0.035, RADIUS, 128]} />
        <meshBasicMaterial ref={edge} toneMapped={false} />
      </mesh>
    </group>
  )
}
