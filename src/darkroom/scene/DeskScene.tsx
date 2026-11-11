import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { FilmRoll } from '../rolls'
import { DR_COLORS } from '../theme'
import { layoutForAspect, type FocusId } from './cameraFocus'
import { CANISTER_LAYOUT, Canister } from './props/Canister'
import { FilmPull } from './props/FilmPull'
import { Lightbox3D } from './props/Lightbox3D'
import { Tray3D } from './props/Tray3D'
import { Viewer3D } from './props/Viewer3D'

interface PropProps {
  id: Exclude<FocusId, 'desk'>
  position: [number, number, number]
  onFocus: (id: FocusId) => void
  children: ReactNode
}

function Prop({ id, position, onFocus, children }: PropProps) {
  return (
    <group
      position={position}
      userData={{ focusId: id }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        onFocus(id)
      }}
    >
      {children}
    </group>
  )
}

function Envelope() {
  return (
    <group rotation={[0, 0.2, 0]}>
      <mesh castShadow receiveShadow position={[0, 0.03, 0]}>
        <boxGeometry args={[0.9, 0.06, 0.6]} />
        <meshStandardMaterial color="#d6c294" roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0, 0.062, -0.15]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.88, 0.008, 0.3]} />
        <meshStandardMaterial color="#c9b17c" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.075, -0.02]}>
        <cylinderGeometry args={[0.055, 0.055, 0.016, 24]} />
        <meshStandardMaterial color="#8c1f1a" roughness={0.35} metalness={0.2} />
      </mesh>
    </group>
  )
}

function Canisters({ rolls }: { rolls: FilmRoll[] }) {
  const visible = rolls.slice(0, CANISTER_LAYOUT.length)
  return (
    <group>
      {visible.map((roll, i) => {
        const layout = CANISTER_LAYOUT[i]!
        return (
          <Canister
            key={roll.id}
            roll={roll}
            styleIndex={i}
            rollNo={i + 1}
            position={layout.position}
            yaw={layout.yaw}
          />
        )
      })}
    </group>
  )
}

function WoodDesk({
  deskSize,
  onFocus,
}: {
  deskSize: [number, number]
  onFocus: (id: FocusId) => void
}) {
  const [woodMap, setWoodMap] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    const loader = new THREE.TextureLoader()
    let alive = true
    let tex: THREE.Texture | null = null
    loader.load('/darkroom/wood.jpg', (loaded) => {
      if (!alive) {
        loaded.dispose()
        return
      }
      loaded.wrapS = loaded.wrapT = THREE.RepeatWrapping
      loaded.repeat.set(deskSize[0] / 2.2, deskSize[1] / 2.2)
      loaded.colorSpace = THREE.SRGBColorSpace
      tex = loaded
      setWoodMap(loaded)
    })
    return () => {
      alive = false
      tex?.dispose()
    }
  }, [deskSize])
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow userData={{ focusId: 'desk' }} onClick={() => onFocus('desk')}>
      <planeGeometry args={deskSize} />
      <meshStandardMaterial map={woodMap ?? undefined} color={DR_COLORS.woodTint} roughness={0.82} metalness={0.04} />
    </mesh>
  )
}

function rollsClusterLocal(): THREE.Vector3 {
  let x = 0
  let y = 0
  let z = 0
  for (const slot of CANISTER_LAYOUT) {
    x += slot.position[0]
    y += slot.position[1]
    z += slot.position[2]
  }
  const n = CANISTER_LAYOUT.length
  // Canisters sit at R+0.03 above layout y (see Canister.tsx).
  return new THREE.Vector3(x / n, y / n + 0.41, z / n)
}

function LampRig({ focus, rollsProp }: { focus: FocusId; rollsProp: [number, number, number] }) {
  const spot = useRef<THREE.SpotLight>(null)
  const target = useRef<THREE.Object3D>(null)
  const deskLook = useMemo(() => new THREE.Vector3(0, 0.08, 0), [])
  const rollsLook = useMemo(() => {
    const local = rollsClusterLocal()
    return new THREE.Vector3(rollsProp[0] + local.x, rollsProp[1] + local.y + 0.1, rollsProp[2] + local.z)
  }, [rollsProp])

  useEffect(() => {
    const obj = target.current
    const light = spot.current
    if (obj && light) light.target = obj
  }, [])

  useFrame((_, dt) => {
    const obj = target.current
    const light = spot.current
    if (!obj || !light) return
    const goal = focus === 'rolls' ? rollsLook : deskLook
    const k = 1 - Math.exp(-5 * dt)
    obj.position.lerp(goal, k)
    light.target = obj
  })

  return (
    <>
      <object3D ref={target} position={deskLook} />
      <spotLight
        ref={spot}
        position={[0.6, 8.5, 2.2]}
        angle={0.62}
        penumbra={0.95}
        intensity={140}
        distance={30}
        decay={2}
        color={DR_COLORS.spot}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-radius={6}
        shadow-bias={-0.0004}
      />
      <pointLight position={[-1, 2.2, 4.5]} intensity={0} color="#ffb47a" distance={8} decay={2} />
      <directionalLight position={[-6, 3, -5]} intensity={0.35} color={DR_COLORS.rim} />
    </>
  )
}

export function DeskScene({
  onFocus,
  rolls = [],
  focus = 'desk',
  activeRollId = null,
}: {
  onFocus: (id: FocusId) => void
  rolls?: FilmRoll[]
  focus?: FocusId
  activeRollId?: string | null
}) {
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const { props, deskSize } = layoutForAspect(aspect)
  return (
    <group>
      <ambientLight intensity={0.18} color={DR_COLORS.ambient} />
      <LampRig focus={focus} rollsProp={props.rolls} />
      <WoodDesk deskSize={deskSize} onFocus={onFocus} />
      <Prop id="envelope" position={props.envelope} onFocus={onFocus}>
        <Envelope />
      </Prop>
      <Prop id="rolls" position={props.rolls} onFocus={onFocus}>
        <Canisters rolls={rolls} />
        <FilmPull focus={focus} rolls={rolls} activeRollId={activeRollId} />
      </Prop>
      <Prop id="lightbox" position={props.lightbox} onFocus={onFocus}>
        <Lightbox3D />
      </Prop>
      <Prop id="tray" position={props.tray} onFocus={onFocus}>
        <Tray3D />
      </Prop>
      <Prop id="viewer" position={props.viewer} onFocus={onFocus}>
        <Viewer3D />
      </Prop>
    </group>
  )
}
