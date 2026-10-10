import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, Box3, CanvasTexture, SpriteMaterial, Vector3, type Group, type Object3D } from 'three'
import { facingFade, FRONT, lampsFor } from './lamps'
import { useIgnitionLevel } from './useIgnitionLevel'

const HEAD_COLOR = '#fff4e0'
const TAIL_COLOR = '#ff2a2a'
const HALO_SIZE = { head: 0.45, tail: 0.3 }
const STREAK_SIZE: [number, number] = [2.4, 0.05]
const STRENGTH = { head: 1.6, tail: 1.2 }

function radialTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.25, 'rgba(255,255,255,0.45)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 64, 64)
  }
  return new CanvasTexture(canvas)
}

const glowMaterial = (map: CanvasTexture, color: string) =>
  new SpriteMaterial({ map, color, blending: AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false })

export function LampGlow({ car }: { car: Object3D }) {
  const lights = useIgnitionLevel()
  const root = useRef<Group>(null)
  const texture = useMemo(radialTexture, [])
  const materials = useMemo(() => ({ head: glowMaterial(texture, HEAD_COLOR), tail: glowMaterial(texture, TAIL_COLOR) }), [texture])
  const lamps = useMemo(() => {
    const box = new Box3().setFromObject(car)
    const local = box.applyMatrix4(car.matrixWorld.clone().invert())
    return lampsFor({ min: local.min.toArray(), max: local.max.toArray() })
  }, [car])
  const forward = useMemo(() => new Vector3(), [])
  const toCamera = useMemo(() => new Vector3(), [])

  useEffect(
    () => () => {
      texture.dispose()
      materials.head.dispose()
      materials.tail.dispose()
    },
    [texture, materials],
  )

  useFrame(({ camera }) => {
    const group = root.current
    if (!group) return
    forward.set(0, 0, FRONT).transformDirection(group.matrixWorld)
    group.getWorldPosition(toCamera)
    toCamera.subVectors(camera.position, toCamera).normalize()
    const facing = forward.dot(toCamera)
    materials.head.opacity = STRENGTH.head * lights.current * facingFade(facing)
    materials.tail.opacity = STRENGTH.tail * lights.current * facingFade(-facing)
  })

  return (
    <group ref={root}>
      {lamps.map((lamp, index) => (
        <group key={index} position={lamp.position}>
          <sprite material={materials[lamp.kind]} scale={HALO_SIZE[lamp.kind]} />
          {lamp.kind === 'head' && <sprite material={materials.head} scale={[...STREAK_SIZE, 1]} />}
        </group>
      ))}
    </group>
  )
}
