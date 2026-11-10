import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { FilmRoll } from '../../rolls'
import { makeCanisterLabelBitmap, rollStyle } from '../labelTex'

const R = 0.38
const L = 1.05
const SEG = 64
const METAL = '#8a8680'
const FELT = '#d8c9a3'
const BODY_METAL = '#3a3834'

interface CanisterProps {
  roll: FilmRoll
  styleIndex: number
  position: [number, number, number]
  yaw?: number
}

export function Canister({ roll, styleIndex, position, yaw = 0 }: CanisterProps) {
  const style = rollStyle(styleIndex)
  const labelMap = useMemo(() => {
    const canvas = makeCanisterLabelBitmap(roll, style)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return tex
  }, [roll.id, roll.title, roll.photoSources.length, style.bg, style.ink, style.band, style.iso])

  useEffect(() => () => labelMap.dispose(), [labelMap])

  const half = L / 2
  return (
    <group position={position} rotation={[0, yaw, Math.PI / 2]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[R, R, L, SEG, 1, true]} />
        <meshStandardMaterial map={labelMap} roughness={0.62} metalness={0.12} side={THREE.DoubleSide} />
      </mesh>
      <mesh castShadow position={[0, half + 0.02, 0]}>
        <cylinderGeometry args={[R * 0.98, R * 0.98, 0.05, SEG]} />
        <meshStandardMaterial color={METAL} roughness={0.28} metalness={0.92} />
      </mesh>
      <mesh castShadow position={[0, -half - 0.02, 0]}>
        <cylinderGeometry args={[R * 0.98, R * 0.98, 0.05, SEG]} />
        <meshStandardMaterial color={METAL} roughness={0.28} metalness={0.92} />
      </mesh>
      <mesh position={[0, half + 0.055, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[R * 0.92, 0.018, 12, SEG]} />
        <meshStandardMaterial color={METAL} roughness={0.22} metalness={0.95} />
      </mesh>
      <mesh position={[0, -half - 0.055, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[R * 0.92, 0.018, 12, SEG]} />
        <meshStandardMaterial color={METAL} roughness={0.22} metalness={0.95} />
      </mesh>
      <mesh castShadow position={[0, -half - 0.09, 0]}>
        <cylinderGeometry args={[R * 0.62, R * 0.62, 0.08, SEG]} />
        <meshStandardMaterial color={BODY_METAL} roughness={0.4} metalness={0.55} />
      </mesh>
      <mesh position={[0, -half - 0.13, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[R * 0.66, 0.014, 10, SEG]} />
        <meshStandardMaterial color={FELT} roughness={0.92} metalness={0} />
      </mesh>
    </group>
  )
}

export const CANISTER_LAYOUT: Array<{ position: [number, number, number]; yaw: number }> = [
  { position: [-0.52, R, -0.22], yaw: 0.15 },
  { position: [-0.12, R, 0.2], yaw: -0.08 },
  { position: [0.22, R, -0.16], yaw: 0.22 },
  { position: [0.56, R, 0.08], yaw: -0.18 },
  { position: [-0.34, R, -0.42], yaw: 0.05 },
]
