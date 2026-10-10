import { useFrame } from '@react-three/fiber'
import { use, useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { CanvasTexture, Color, SRGBColorSpace, type Mesh, type MeshBasicMaterial } from 'three'
import type { RoomLevel } from './useRoomLevel'

const NEON = new Color('#C1272D')
const GLOW = 3
const FONT = '700 104px Rajdhani, sans-serif'
const MARGIN = 32

function drawSign(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 160
  const context = canvas.getContext('2d')
  if (context) {
    context.font = FONT
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.lineWidth = 6
    context.strokeStyle = '#ffffff'
    context.letterSpacing = '18px'
    context.strokeText('MIDNIGHT GARAGE', 512, 84, canvas.width - MARGIN * 2)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

let fontLoad: Promise<void> | null = null

function loadFont(): Promise<void> {
  fontLoad ??= document.fonts ? document.fonts.load(FONT).then(() => undefined, () => undefined) : Promise.resolve()
  return fontLoad
}

export function NeonSign({ level }: { level: MutableRefObject<RoomLevel> }) {
  use(loadFont())
  const texture = useMemo(drawSign, [])
  useEffect(() => () => texture.dispose(), [texture])
  const mesh = useRef<Mesh>(null)
  const material = useRef<MeshBasicMaterial>(null)

  useFrame(() => {
    const { presence, glow } = level.current
    if (mesh.current) mesh.current.visible = presence > 0.01
    material.current?.color.copy(NEON).multiplyScalar(GLOW * glow)
    if (material.current) material.current.opacity = presence
  })

  return (
    <mesh ref={mesh} position={[0, 1.3, 0.1]} renderOrder={1}>
      <planeGeometry args={[3.2, 0.5]} />
      <meshBasicMaterial ref={material} map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}
