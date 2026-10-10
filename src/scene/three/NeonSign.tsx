import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { CanvasTexture, Color, SRGBColorSpace, type Mesh, type MeshBasicMaterial } from 'three'
import type { RoomLevel } from './useRoomLevel'

const NEON = new Color('#C1272D')
const GLOW = 3

function drawSign(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 160
  const context = canvas.getContext('2d')
  if (context) {
    context.font = '600 104px Rajdhani, sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.lineWidth = 6
    context.strokeStyle = '#ffffff'
    context.letterSpacing = '18px'
    context.strokeText('MIDNIGHT GARAGE', 512, 84)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export function NeonSign({ level }: { level: MutableRefObject<RoomLevel> }) {
  const [fontsReady, setFontsReady] = useState(false)
  useEffect(() => {
    let alive = true
    document.fonts.ready.then(() => alive && setFontsReady(true), () => alive && setFontsReady(true))
    return () => {
      alive = false
    }
  }, [])
  const texture = useMemo(() => (fontsReady ? drawSign() : null), [fontsReady])
  useEffect(() => () => texture?.dispose(), [texture])
  const mesh = useRef<Mesh>(null)
  const material = useRef<MeshBasicMaterial>(null)

  useFrame(() => {
    const { presence, glow } = level.current
    if (mesh.current) mesh.current.visible = presence > 0.01 && texture !== null
    material.current?.color.copy(NEON).multiplyScalar(GLOW * glow)
    if (material.current) material.current.opacity = presence
  })

  if (!texture) return null
  return (
    <mesh ref={mesh} position={[0, 4.6, 0.06]}>
      <planeGeometry args={[6.4, 1]} />
      <meshBasicMaterial ref={material} map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}
