import { useThree, type ThreeEvent } from '@react-three/fiber'
import type { ReactNode } from 'react'
import { layoutForAspect, type FocusId } from './cameraFocus'

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

function Canisters() {
  const items: Array<[number, number, string]> = [
    [-0.18, 0.05, '#2b2b2b'],
    [0.16, -0.08, '#3a2f26'],
    [0.0, 0.2, '#242830'],
  ]
  return (
    <group>
      {items.map(([x, z, color]) => (
        <group key={`${x}-${z}`} position={[x, 0, z]}>
          <mesh castShadow receiveShadow position={[0, 0.17, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.34, 32]} />
            <meshStandardMaterial color={color} roughness={0.45} metalness={0.55} />
          </mesh>
          <mesh position={[0, 0.345, 0]}>
            <cylinderGeometry args={[0.135, 0.135, 0.02, 32]} />
            <meshStandardMaterial color="#9a9488" roughness={0.3} metalness={0.9} />
          </mesh>
          <mesh position={[0, 0.17, 0]}>
            <cylinderGeometry args={[0.1325, 0.1325, 0.1, 32]} />
            <meshStandardMaterial color="#d8c9a3" roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Lightbox() {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.1, 0]}>
        <boxGeometry args={[1.4, 0.2, 1]} />
        <meshStandardMaterial color="#2a2623" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.205, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.25, 0.85]} />
        <meshStandardMaterial color="#fff1d6" emissive="#ffd9a0" emissiveIntensity={1.4} roughness={0.5} />
      </mesh>
      <pointLight position={[0, 0.6, 0]} intensity={2.5} distance={3.5} color="#ffd9a0" />
    </group>
  )
}

function Tray() {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.03, 0]}>
        <boxGeometry args={[1.2, 0.06, 0.8]} />
        <meshStandardMaterial color="#5a2a22" roughness={0.55} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.065, 0]}>
        <boxGeometry args={[1.04, 0.02, 0.64]} />
        <meshStandardMaterial color="#1c0f0c" roughness={0.15} metalness={0.4} />
      </mesh>
      {[
        [0, 0.3],
        [0, -0.3],
      ].map(([x, z]) => (
        <mesh key={z} castShadow position={[x, 0.09, z]}>
          <boxGeometry args={[1.2, 0.06, 0.04]} />
          <meshStandardMaterial color="#5a2a22" roughness={0.55} />
        </mesh>
      ))}
    </group>
  )
}

function Viewer() {
  return (
    <group>
      <mesh castShadow position={[0, -0.15, 0]}>
        <boxGeometry args={[0.5, 0.2, 0.4]} />
        <meshStandardMaterial color="#2c2c2e" roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh castShadow position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.3, 32]} />
        <meshStandardMaterial color="#444" roughness={0.35} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0.05, 0.16]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.12, 32]} />
        <meshPhysicalMaterial color="#10161c" roughness={0.05} metalness={0.2} clearcoat={1} />
      </mesh>
    </group>
  )
}

export function DeskScene({ onFocus }: { onFocus: (id: FocusId) => void }) {
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const { props, deskSize } = layoutForAspect(aspect)
  return (
    <group>
      <ambientLight intensity={0.4} />
      <hemisphereLight args={['#3a2a24', '#0a0706', 0.7]} />
      <pointLight position={[0, 3, 1]} intensity={8} color="#ff5a3c" />
      <spotLight
        position={[-1, 4.5, 2.5]}
        angle={0.7}
        penumbra={0.8}
        intensity={30}
        color="#ffb890"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow userData={{ focusId: 'desk' }} onClick={() => onFocus('desk')}>
        <planeGeometry args={deskSize} />
        <meshStandardMaterial color="#2a1f18" roughness={0.75} metalness={0.05} />
      </mesh>
      <Prop id="envelope" position={props.envelope} onFocus={onFocus}><Envelope /></Prop>
      <Prop id="rolls" position={props.rolls} onFocus={onFocus}><Canisters /></Prop>
      <Prop id="lightbox" position={props.lightbox} onFocus={onFocus}><Lightbox /></Prop>
      <Prop id="tray" position={props.tray} onFocus={onFocus}><Tray /></Prop>
      <Prop id="viewer" position={props.viewer} onFocus={onFocus}><Viewer /></Prop>
    </group>
  )
}
