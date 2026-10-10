import { MeshReflectorMaterial } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type MeshBasicMaterial } from 'three'
import { damp, TRACK_SPEED, TRANSITION_LAMBDA } from '../motion'
import type { Pose } from '../poses'
import { TEXTURE_URLS, useTiledTextures } from './textures'

function trackLinesTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (context) {
    context.fillStyle = 'rgba(134, 134, 140, 0.55)'
    context.fillRect(2, 0, 3, 256)
    context.fillRect(59, 0, 3, 256)
    context.fillStyle = '#C1272D'
    context.fillRect(30, 0, 4, 120)
  }
  const texture = new CanvasTexture(canvas)
  texture.wrapT = RepeatWrapping
  texture.repeat.set(1, 33)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

interface FloorProps {
  pose: Pose
  deterministic: boolean
  reflection: 512 | 256 | null
}

export function Floor({ pose, deterministic, reflection }: FloorProps) {
  const concrete = useTiledTextures(TEXTURE_URLS.floor, [50, 50])
  const lines = useMemo(trackLinesTexture, [])
  const linesMaterial = useRef<MeshBasicMaterial>(null)

  useEffect(() => () => lines.dispose(), [lines])

  useFrame((_, delta) => {
    const material = linesMaterial.current
    if (!material) return
    const dt = Math.min(delta, 0.1)
    const goal = pose.trackLines ? 1 : 0
    material.opacity = deterministic ? goal : damp(material.opacity, goal, TRANSITION_LAMBDA, dt)
    material.visible = material.opacity > 0.01
    if (!deterministic) lines.offset.y -= TRACK_SPEED * dt
  })

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
        <planeGeometry args={[200, 200]} />
        {reflection === null ? (
          <meshStandardMaterial
            map={concrete.map}
            roughnessMap={concrete.roughnessMap}
            normalMap={concrete.normalMap}
            normalScale={[0.4, 0.4]}
            color="#2a2a2e"
            metalness={0.2}
            roughness={1}
          />
        ) : (
          <MeshReflectorMaterial
            // drei 只在创建反射器时读取 resolution，换 key 才能按新分辨率重建
            key={reflection}
            resolution={reflection}
            blur={[300, 80]}
            mixBlur={1}
            mixStrength={0.6}
            metalness={0.2}
            depthScale={0.6}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.2}
            map={concrete.map}
            roughnessMap={concrete.roughnessMap}
            normalMap={concrete.normalMap}
            normalScale={[0.4, 0.4]}
            color="#2a2a2e"
            roughness={1}
          />
        )}
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[6, 200]} />
        <meshBasicMaterial ref={linesMaterial} map={lines} transparent opacity={pose.trackLines ? 1 : 0} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}
