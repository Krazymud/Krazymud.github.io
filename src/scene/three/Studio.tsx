import { Environment, Lightformer } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { Color, type Mesh, type MeshBasicMaterial, type SpotLight } from 'three'
import { dampFactor, STILL_SWEEP_X, sweepX, TRANSITION_LAMBDA } from '../motion'
import { GOLD, type Pose } from '../poses'
import { useIgnitionLevel } from './useIgnitionLevel'

const KEY_INTENSITY = 150
const RIM_SPOT_INTENSITY = 120
const RIM_PANEL_INTENSITY = 2
const RIM_TARGET: [number, number, number] = [0, 0.6, 0]

interface StudioProps {
  pose: Pose
  deterministic: boolean
}

export function Studio({ pose, deterministic }: StudioProps) {
  const lights = useIgnitionLevel()
  const scene = useThree((state) => state.scene)
  const key = useRef<SpotLight>(null)
  const sweep = useRef<Mesh>(null)
  const rimSpot = useRef<SpotLight>(null)
  const rimPanel = useRef<Mesh>(null)
  const rim = useRef(pose.rim)
  // Rim props must not follow pose.rim: Lightformer re-applies them on change and the reflections would snap for a frame.
  const [initialRim] = useState(pose.rim)
  const goal = useMemo(() => new Color(), [])

  useFrame(({ clock }, delta) => {
    const k = dampFactor(TRANSITION_LAMBDA, Math.min(delta, 0.1))
    goal.set(pose.light)
    scene.environmentIntensity = lights.current
    if (key.current) {
      key.current.intensity = KEY_INTENSITY * lights.current
      if (deterministic) key.current.color.copy(goal)
      else key.current.color.lerp(goal, k)
    }
    rim.current = deterministic ? pose.rim : rim.current + (pose.rim - rim.current) * k
    if (rimSpot.current) rimSpot.current.intensity = RIM_SPOT_INTENSITY * rim.current * lights.current
    if (rimPanel.current) {
      rimPanel.current.visible = rim.current > 0.001
      ;(rimPanel.current.material as MeshBasicMaterial).color.set(GOLD).multiplyScalar(RIM_PANEL_INTENSITY * rim.current)
    }
    if (sweep.current) {
      const x = pose.sweep ? (deterministic ? STILL_SWEEP_X : sweepX(clock.elapsedTime)) : null
      sweep.current.visible = x !== null
      if (x !== null) sweep.current.position.x = x
    }
  })

  return (
    <>
      <spotLight ref={key} position={[3, 7, 4]} angle={0.55} penumbra={1} intensity={KEY_INTENSITY} decay={2} color={pose.light} />
      <spotLight ref={rimSpot} position={[0, 4.5, 5.5]} angle={0.6} penumbra={1} intensity={RIM_SPOT_INTENSITY * initialRim} decay={2} color={GOLD} />
      <Environment frames={deterministic ? 1 : Infinity} resolution={128}>
        <Lightformer form="rect" intensity={3} color="#ffffff" position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 1.2, 1]} />
        <Lightformer form="rect" intensity={2} color="#ffffff" position={[0, 6, -3]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 0.6, 1]} />
        <Lightformer form="rect" intensity={2} color="#ffffff" position={[0, 6, 3]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 0.6, 1]} />
        <Lightformer form="rect" intensity={1.5} color="#ffffff" position={[-8, 2.5, 0]} rotation={[0, Math.PI / 2, 0]} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={1.5} color="#ffffff" position={[8, 2.5, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={1.5} color="#ffffff" position={[0, 2.5, -8]} rotation={[0, 0, 0]} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={1.5} color="#ffffff" position={[0, 2.5, 8]} rotation={[0, Math.PI, 0]} scale={[10, 3, 1]} />
        <Lightformer ref={sweep} form="rect" intensity={4} color="#C1272D" visible={pose.sweep} position={[deterministic ? STILL_SWEEP_X : (sweepX(0) ?? 0), 4, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.8, 14, 1]} />
        <Lightformer ref={rimPanel} form="rect" intensity={RIM_PANEL_INTENSITY * initialRim} color={GOLD} visible={initialRim > 0} position={[0, 4, 6]} target={RIM_TARGET} scale={[6, 1.5, 1]} />
      </Environment>
    </>
  )
}
