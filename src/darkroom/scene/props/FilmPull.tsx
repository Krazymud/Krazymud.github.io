import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { FilmRoll } from '../../rolls'
import type { FocusId } from '../cameraFocus'

/** World units per frame cell (image + sprocket gutter). */
export const FILM_FRAME_PITCH = 0.14

const LEADER = FILM_FRAME_PITCH * 0.5

export function filmLengthForFrames(n: number): number {
  const count = Math.max(0, Math.floor(n))
  const body = count * FILM_FRAME_PITCH + (count > 0 ? LEADER : 0)
  return Math.max(FILM_FRAME_PITCH * 2, body)
}

function makeStripTexture(frameCount: number): THREE.CanvasTexture {
  const cells = Math.max(1, Math.min(frameCount, 24))
  const w = 64 * cells
  const h = 96
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#0a0806'
  ctx.fillRect(0, 0, w, h)
  const cellW = w / cells
  for (let i = 0; i < cells; i++) {
    const x = i * cellW
    ctx.fillStyle = '#f5e6c8'
    for (let row = 0; row < 8; row++) {
      const sy = 4 + row * 11
      ctx.fillRect(x + 6, sy, 8, 6)
      ctx.fillRect(x + cellW - 14, sy, 8, 6)
    }
    const inset = cellW * 0.14
    const hue = (i * 47) % 360
    ctx.fillStyle = `hsl(${hue}, 22%, 38%)`
    ctx.fillRect(x + inset, 14, cellW - inset * 2, h - 28)
    ctx.strokeStyle = 'rgba(255,214,160,0.15)'
    ctx.strokeRect(x + inset + 2, 16, cellW - inset * 2 - 4, h - 32)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.anisotropy = 4
  return tex
}

const PULL_Z_REST = -0.42
const PULL_Z_OUT = 0.55

export function FilmPull({
  focus,
  rolls,
  activeRollId = null,
}: {
  focus: FocusId
  rolls: FilmRoll[]
  activeRollId?: string | null
}) {
  const group = useRef<THREE.Group>(null)
  const visible = focus === 'rolls' || focus === 'lightbox'

  const frameCount = useMemo(() => {
    if (activeRollId) {
      return rolls.find((r) => r.id === activeRollId)?.photoSources.length ?? 0
    }
    return rolls[0]?.photoSources.length ?? 0
  }, [rolls, activeRollId])

  const length = filmLengthForFrames(frameCount)
  const stripMap = useMemo(() => makeStripTexture(frameCount), [frameCount])
  useEffect(() => () => stripMap.dispose(), [stripMap])

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const goal = visible ? PULL_Z_OUT : PULL_Z_REST
    const k = 1 - Math.exp(-6 * dt)
    g.position.z += (goal - g.position.z) * k
    const targetOpacity = visible ? 1 : 0.35
    g.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      const mat = mesh.material as THREE.MeshPhysicalMaterial | undefined
      if (mat?.isMeshPhysicalMaterial) {
        mat.opacity += (targetOpacity - mat.opacity) * k
      }
    })
  })

  return (
    <group ref={group} position={[0.08, 0.46, PULL_Z_REST]} rotation={[-Math.PI / 2.15, 0, 0]}>
      <mesh castShadow receiveShadow>
        <planeGeometry args={[length, 0.22]} />
        <meshPhysicalMaterial
          map={stripMap}
          color="#2a241c"
          emissive="#ffb870"
          emissiveIntensity={visible ? 0.35 : 0.12}
          roughness={0.38}
          metalness={0.08}
          clearcoat={0.85}
          clearcoatRoughness={0.22}
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}
