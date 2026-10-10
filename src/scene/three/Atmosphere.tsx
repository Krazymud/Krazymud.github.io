import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Quaternion, Vector3, type MeshBasicMaterial, type PointsMaterial } from 'three'
import type { Ambience } from '../ambience'
import type { Pose } from '../poses'
import { useRoomLevel } from './useRoomLevel'

const KEY_POSITION = new Vector3(3, 7, 4)
const BEAM_LENGTH = KEY_POSITION.length()
const BEAM_OPACITY = 0.05
const DUST_COUNT = 150
const DUST_BOX: [number, number, number] = [8, 4, 8]
const DUST_SPEED = 0.05

function seeded(i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

export function Atmosphere({ pose, ambience, deterministic }: { pose: Pose; ambience: Ambience; deterministic: boolean }) {
  const level = useRoomLevel(pose, ambience, deterministic)
  const beam = useRef<MeshBasicMaterial>(null)
  const dust = useRef<PointsMaterial>(null)
  const beamColor = useMemo(() => new Color(), [])

  const orientation = useMemo(() => {
    const down = KEY_POSITION.clone().negate().normalize()
    return new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), down)
  }, [])
  const midpoint = useMemo(() => KEY_POSITION.clone().multiplyScalar(0.5), [])

  const geometry = useMemo(() => {
    const positions = new Float32Array(DUST_COUNT * 3)
    for (let i = 0; i < DUST_COUNT; i++) {
      positions[i * 3] = (seeded(i) - 0.5) * DUST_BOX[0]
      positions[i * 3 + 1] = seeded(i + 1000) * DUST_BOX[1]
      positions[i * 3 + 2] = (seeded(i + 2000) - 0.5) * DUST_BOX[2]
    }
    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(positions, 3))
    return result
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((_, delta) => {
    const { presence, glow } = level.current
    if (beam.current) {
      beamColor.set(ambience.key)
      beam.current.color.copy(beamColor)
      beam.current.opacity = BEAM_OPACITY * glow
      beam.current.visible = presence > 0.01
    }
    if (dust.current) {
      dust.current.opacity = 0.35 * presence
      dust.current.visible = presence > 0.01
    }
    if (deterministic) return
    const positions = geometry.getAttribute('position') as BufferAttribute
    const dt = Math.min(delta, 0.1)
    for (let i = 0; i < DUST_COUNT; i++) {
      let y = positions.getY(i) + DUST_SPEED * dt * (0.5 + seeded(i + 3000))
      if (y > DUST_BOX[1]) y -= DUST_BOX[1]
      positions.setY(i, y)
    }
    positions.needsUpdate = true
  })

  return (
    <group>
      <mesh position={midpoint} quaternion={orientation}>
        <coneGeometry args={[2.2, BEAM_LENGTH, 48, 1, true]} />
        <meshBasicMaterial ref={beam} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} side={DoubleSide} />
      </mesh>
      <points geometry={geometry}>
        <pointsMaterial ref={dust} color="#f3e6d0" size={0.025} sizeAttenuation transparent depthWrite={false} blending={AdditiveBlending} />
      </points>
    </group>
  )
}
