import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { FilmRoll } from '../../rolls'
import { makeCanisterLabelBitmap, rollStyle } from '../labelTex'

const R = 0.38
const L = 1.05
const SEG = 64

interface CanisterProps {
  roll: FilmRoll
  styleIndex: number
  rollNo: number
  position: [number, number, number]
  yaw?: number
}

export function Canister({ roll, styleIndex, rollNo, position, yaw = 0 }: CanisterProps) {
  const style = rollStyle(styleIndex)
  const labelMap = useMemo(() => {
    const canvas = makeCanisterLabelBitmap(roll, style, rollNo)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    return tex
  }, [roll.id, roll.title, rollNo, style.bg, style.ink, style.band, style.iso])

  useEffect(() => () => labelMap.dispose(), [labelMap])

  const metal = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#b9b1a5', metalness: 0.92, roughness: 0.32 }),
    [],
  )
  const dark = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#1a1512', metalness: 0.5, roughness: 0.6 }),
    [],
  )
  const felt = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0e0b0a', roughness: 1 }), [])

  useEffect(
    () => () => {
      metal.dispose()
      dark.dispose()
      felt.dispose()
    },
    [metal, dark, felt],
  )

  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <group rotation={[0, 0, Math.PI / 2]} position={[0, R + 0.03, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[R, R, L, SEG, 1, true]} />
          <meshStandardMaterial map={labelMap} roughness={0.55} metalness={0.15} side={THREE.DoubleSide} />
        </mesh>
        <mesh castShadow position={[0, L / 2 + 0.04, 0]} material={metal}>
          <cylinderGeometry args={[R + 0.025, R + 0.025, 0.09, SEG]} />
        </mesh>
        <mesh castShadow position={[0, -L / 2 - 0.04, 0]} material={metal}>
          <cylinderGeometry args={[R + 0.025, R + 0.025, 0.09, SEG]} />
        </mesh>
        <mesh position={[0, L / 2 - 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} material={metal}>
          <torusGeometry args={[R + 0.01, 0.012, 8, SEG]} />
        </mesh>
        <mesh position={[0, -L / 2 + 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} material={metal}>
          <torusGeometry args={[R + 0.01, 0.012, 8, SEG]} />
        </mesh>
        <mesh castShadow position={[0, L / 2 + 0.16, 0]} material={dark}>
          <cylinderGeometry args={[0.1, 0.1, 0.16, 24]} />
        </mesh>
        <mesh castShadow position={[0, L / 2 + 0.26, 0]} material={metal}>
          <cylinderGeometry args={[0.06, 0.06, 0.05, 20]} />
        </mesh>
        {/* Felt light-trap lip on the body side (exit mouth). */}
        <mesh castShadow receiveShadow position={[0, 0, R + 0.005]} material={felt}>
          <boxGeometry args={[0.16, L * 0.86, 0.07]} />
        </mesh>
      </group>
    </group>
  )
}

export const CANISTER_LAYOUT: Array<{ position: [number, number, number]; yaw: number }> = [
  { position: [-0.52, 0, -0.22], yaw: 0.15 },
  { position: [-0.12, 0, 0.2], yaw: -0.08 },
  { position: [0.22, 0, -0.16], yaw: 0.22 },
  { position: [0.56, 0, 0.08], yaw: -0.18 },
  { position: [-0.34, 0, -0.42], yaw: 0.05 },
]
