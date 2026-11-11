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

/** Procedural orange acetate base + sprocket punch — shell parity without private frames. */
function makeStripTexture(frameCount: number): THREE.CanvasTexture {
  const cells = Math.max(1, Math.min(frameCount || 8, 24))
  const FW = 64
  const FH = 96
  const w = FW * cells
  const h = FH
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#c4642a'
  ctx.fillRect(0, 0, w, h)
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, 'rgba(80,25,0,.4)')
  g.addColorStop(0.12, 'rgba(80,25,0,.1)')
  g.addColorStop(0.5, 'rgba(255,205,150,.14)')
  g.addColorStop(0.88, 'rgba(80,25,0,.1)')
  g.addColorStop(1, 'rgba(80,25,0,.4)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  for (let i = 0; i < cells; i++) {
    const x = i * FW
    const inset = 10
    ctx.fillStyle = 'rgba(60,18,2,.35)'
    ctx.fillRect(x + inset - 2, 14, FW - inset * 2 + 4, h - 28)
    const hue = (i * 47) % 360
    ctx.fillStyle = `hsl(${hue}, 18%, 22%)`
    ctx.fillRect(x + inset, 16, FW - inset * 2, h - 32)
    ctx.fillStyle = 'rgba(185,80,25,.35)'
    ctx.fillRect(x + inset, 16, FW - inset * 2, h - 32)
  }

  // Sprocket punch (destination-out)
  ctx.globalCompositeOperation = 'destination-out'
  for (let px = 6; px < w; px += 22) {
    roundRect(ctx, px, 4, 10, 14, 2)
    ctx.fill()
    roundRect(ctx, px, h - 18, 10, 14, 2)
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.anisotropy = 8
  return tex
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
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

  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(length, 0.95, 140, 1)
    const p = g.attributes.position!
    for (let i = 0; i < p.count; i++) {
      const u = (p.getX(i)! + length / 2) / length
      p.setZ(i, Math.sin(u * Math.PI) * 0.08 * Math.exp(-u * 1.2) + Math.sin(u * Math.PI * 4) * 0.008)
    }
    g.computeVertexNormals()
    return g
  }, [length])
  useEffect(() => () => geo.dispose(), [geo])

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
      <mesh castShadow receiveShadow geometry={geo}>
        <meshPhysicalMaterial
          map={stripMap}
          transparent
          alphaTest={0.4}
          roughness={0.45}
          metalness={0}
          clearcoat={0.7}
          clearcoatRoughness={0.22}
          emissive="#5a2008"
          emissiveIntensity={0.35}
          opacity={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}
