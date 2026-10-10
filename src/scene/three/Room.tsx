import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, MeshBasicMaterial, type Group, type Material } from 'three'
import type { Ambience } from '../ambience'
import type { Pose } from '../poses'
import { NeonSign } from './NeonSign'
import { TEXTURE_URLS, useTiledTextures } from './textures'
import { ROOM_ANCHOR, useRoomLevel } from './useRoomLevel'

const WALL_WIDTH = 16
const WALL_HEIGHT = 6
const STRIP_X = [-5.4, -1.8, 1.8, 5.4]
const STRIP_COLOR = new Color('#dfe8ff')
const STRIP_GLOW = 2.4

function ToolCabinet() {
  return (
    <group>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[1.4, 1.1, 0.6]} />
        <meshStandardMaterial color="#121215" metalness={0.6} roughness={0.5} transparent />
      </mesh>
      <mesh position={[0, 1.45, -0.1]}>
        <boxGeometry args={[1.4, 0.7, 0.4]} />
        <meshStandardMaterial color="#0f0f12" metalness={0.6} roughness={0.5} transparent />
      </mesh>
    </group>
  )
}

function TireRack() {
  return (
    <group>
      {[0.36, 0.86, 1.36].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.34, 0.14, 12, 32]} />
          <meshStandardMaterial color="#09090b" roughness={0.9} transparent />
        </mesh>
      ))}
    </group>
  )
}

export function Room({ pose, ambience, deterministic }: { pose: Pose; ambience: Ambience; deterministic: boolean }) {
  const level = useRoomLevel(pose, ambience, deterministic)
  const metal = useTiledTextures(TEXTURE_URLS.wall, [4, 1.5])
  const group = useRef<Group>(null)
  const strips = useMemo(() => new MeshBasicMaterial({ toneMapped: false }), [])
  useEffect(() => () => strips.dispose(), [strips])
  const fading = useMemo<Material[]>(() => [], [])

  useFrame(() => {
    const { presence, glow } = level.current
    const root = group.current
    if (!root) return
    root.visible = presence > 0.01
    if (fading.length === 0) {
      root.traverse((object) => {
        const material = (object as { material?: Material }).material
        if (material && material.transparent) fading.push(material)
      })
    }
    for (const material of fading) material.opacity = presence
    strips.color.copy(STRIP_COLOR).multiplyScalar(STRIP_GLOW * glow)
  })

  return (
    <group ref={group} position={ROOM_ANCHOR.position} rotation={[0, ROOM_ANCHOR.rotationY, 0]}>
      <mesh position={[0, WALL_HEIGHT / 2, 0]}>
        <planeGeometry args={[WALL_WIDTH, WALL_HEIGHT]} />
        <meshStandardMaterial {...metal} color="#3a3a40" metalness={0.7} roughness={1} transparent />
      </mesh>
      {STRIP_X.map((x) => (
        <mesh key={x} position={[x, 2.6, 0.04]} material={strips}>
          <boxGeometry args={[0.06, 4.2, 0.04]} />
        </mesh>
      ))}
      <NeonSign level={level} />
      <group position={[-6.4, 0, 1.2]}>
        <ToolCabinet />
      </group>
      <group position={[6.6, 0, 1.4]}>
        <TireRack />
      </group>
    </group>
  )
}
