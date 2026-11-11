import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'

function useSteelMaps() {
  const [maps, setMaps] = useState<{
    map: THREE.Texture
    normalMap: THREE.Texture
    roughnessMap: THREE.Texture
  } | null>(null)

  useEffect(() => {
    const loader = new THREE.TextureLoader()
    let alive = true
    const load = (url: string, srgb: boolean) =>
      new Promise<THREE.Texture>((resolve, reject) => {
        loader.load(
          url,
          (t) => {
            t.wrapS = t.wrapT = THREE.RepeatWrapping
            if (srgb) t.colorSpace = THREE.SRGBColorSpace
            resolve(t)
          },
          undefined,
          reject,
        )
      })
    Promise.all([
      load('/darkroom/steel/steel_col.jpg', true),
      load('/darkroom/steel/steel_nor_gl.jpg', false),
      load('/darkroom/steel/steel_rough.jpg', false),
    ]).then(([map, normalMap, roughnessMap]) => {
      if (!alive) {
        map.dispose()
        normalMap.dispose()
        roughnessMap.dispose()
        return
      }
      setMaps({ map, normalMap, roughnessMap })
    })
    return () => {
      alive = false
      setMaps((prev) => {
        prev?.map.dispose()
        prev?.normalMap.dispose()
        prev?.roughnessMap.dispose()
        return null
      })
    }
  }, [])

  return maps
}

function steelMaterial(
  maps: { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture } | null,
  rx: number,
  ry: number,
) {
  if (!maps) {
    return <meshStandardMaterial color="#efeae4" metalness={1} roughness={0.45} side={THREE.DoubleSide} />
  }
  const clone = (t: THREE.Texture) => {
    const c = t.clone()
    c.repeat.set(rx, ry)
    c.needsUpdate = true
    return c
  }
  return (
    <meshStandardMaterial
      color="#efeae4"
      metalness={1}
      roughness={0.55}
      map={clone(maps.map)}
      normalMap={clone(maps.normalMap)}
      roughnessMap={clone(maps.roughnessMap)}
      normalScale={new THREE.Vector2(0.6, 0.6)}
      side={THREE.DoubleSide}
      envMapIntensity={2.2}
    />
  )
}

/** Bamboo tongs with rubber tips — geometry from reference tray.html (no personal content). */
export function Tongs3D() {
  const bambooMap = useMemo(() => {
    const bc = document.createElement('canvas')
    bc.width = 64
    bc.height = 512
    const x = bc.getContext('2d')!
    x.fillStyle = '#c9a46a'
    x.fillRect(0, 0, 64, 512)
    for (let i = 0; i < 70; i++) {
      x.strokeStyle = `rgba(${Math.random() < 0.5 ? '120,85,40' : '235,205,150'},${0.15 + Math.random() * 0.25})`
      x.lineWidth = 0.6 + Math.random() * 1.2
      const px = Math.random() * 64
      x.beginPath()
      x.moveTo(px, 0)
      x.lineTo(px + (Math.random() - 0.5) * 3, 512)
      x.stroke()
    }
    ;[150, 380].forEach((y) => {
      x.fillStyle = 'rgba(110,75,35,.55)'
      x.fillRect(0, y, 64, 5)
      x.fillStyle = 'rgba(240,215,165,.4)'
      x.fillRect(0, y + 5, 64, 2)
    })
    const t = new THREE.CanvasTexture(bc)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  useEffect(() => () => bambooMap.dispose(), [bambooMap])

  const TL = 0.72
  return (
    <group position={[0.42, 0.12, 0.18]} rotation={[0.15, 0.4, -0.55]}>
      {([-1, 1] as const).map((sd) => (
        <group key={sd} position={[sd * 0.018, 0, TL / 2]}>
          <mesh castShadow position={[0, 0, -(TL - 0.05) / 2]}>
            <boxGeometry args={[0.055, 0.014, TL - 0.05]} />
            <meshStandardMaterial map={bambooMap} roughness={0.55} />
          </mesh>
          <mesh castShadow position={[-sd * 0.006, 0, -TL + 0.08]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.024, 0.028, 0.11, 12]} />
            <meshStandardMaterial color="#9e2a1e" roughness={0.6} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0, TL / 2 - 0.02]}>
        <cylinderGeometry args={[0.012, 0.012, 0.045, 12]} />
        <meshStandardMaterial color="#b8b0a4" metalness={1} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, TL / 2 + 0.03]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.042, 0.006, 8, 24]} />
        <meshStandardMaterial color="#b8b0a4" metalness={1} roughness={0.35} />
      </mesh>
    </group>
  )
}

export function Tray3D() {
  const maps = useSteelMaps()
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.04, 0]}>
        <boxGeometry args={[1.22, 0.055, 0.82]} />
        {steelMaterial(maps, 1, 1)}
      </mesh>
      {([-0.31, 0.31] as const).map((z) => (
        <mesh key={`z-${z}`} castShadow position={[0, 0.095, z]}>
          <boxGeometry args={[1.22, 0.05, 0.035]} />
          {steelMaterial(maps, 0.9, 2.2)}
        </mesh>
      ))}
      {([-0.58, 0.58] as const).map((x) => (
        <mesh key={`x-${x}`} castShadow position={[x, 0.095, 0]}>
          <boxGeometry args={[0.035, 0.05, 0.82]} />
          {steelMaterial(maps, 0.9, 2.2)}
        </mesh>
      ))}
      <mesh position={[0, 0.072, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.06, 0.66]} />
        <meshPhysicalMaterial
          color="#1a100c"
          roughness={0.08}
          metalness={0.15}
          transmission={0.35}
          thickness={0.08}
          ior={1.33}
          transparent
          opacity={0.88}
          clearcoat={0.6}
          clearcoatRoughness={0.15}
        />
      </mesh>
      <Tongs3D />
    </group>
  )
}
