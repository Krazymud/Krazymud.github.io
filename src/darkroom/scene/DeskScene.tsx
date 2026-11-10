import type { ThreeEvent } from '@react-three/fiber'
import type { ReactNode } from 'react'
import type { FocusId } from './cameraFocus'

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

export function DeskScene({ onFocus }: { onFocus: (id: FocusId) => void }) {
  return (
    <group>
      <ambientLight intensity={0.15} />
      <pointLight position={[0, 3, 1]} intensity={8} color="#ff5a3c" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow userData={{ focusId: 'desk' }} onClick={() => onFocus('desk')}>
        <planeGeometry args={[9, 5]} />
        <meshStandardMaterial color="#1a1512" roughness={0.9} />
      </mesh>
      <Prop id="envelope" position={[-2.2, 0.05, 0.2]} onFocus={onFocus}>
        <mesh><boxGeometry args={[0.9, 0.1, 0.6]} /><meshStandardMaterial color="#c9b48a" /></mesh>
      </Prop>
      <Prop id="rolls" position={[-0.6, 0.2, 0.4]} onFocus={onFocus}>
        <mesh><cylinderGeometry args={[0.2, 0.2, 0.4, 24]} /><meshStandardMaterial color="#2b2b2b" /></mesh>
      </Prop>
      <Prop id="lightbox" position={[1.4, 0.15, -0.4]} onFocus={onFocus}>
        <mesh><boxGeometry args={[1.4, 0.3, 1]} /><meshStandardMaterial color="#ddd" emissive="#ffd9a0" emissiveIntensity={0.6} /></mesh>
      </Prop>
      <Prop id="tray" position={[2.8, 0.05, 0.6]} onFocus={onFocus}>
        <mesh><boxGeometry args={[1.2, 0.1, 0.8]} /><meshStandardMaterial color="#5a2a22" /></mesh>
      </Prop>
      <Prop id="viewer" position={[0, 0.9, 0]} onFocus={onFocus}>
        <mesh><boxGeometry args={[0.5, 0.5, 0.5]} /><meshStandardMaterial color="#444" /></mesh>
      </Prop>
    </group>
  )
}
