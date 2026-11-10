import { DR_COLORS } from '../../theme'

export function Lightbox3D() {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.1, 0]}>
        <boxGeometry args={[1.42, 0.18, 1.02]} />
        <meshStandardMaterial color="#2a2623" roughness={0.55} metalness={0.35} />
      </mesh>
      <mesh position={[0, 0.198, 0.01]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.28, 0.88]} />
        <meshStandardMaterial
          color="#fff4e0"
          emissive={DR_COLORS.spot}
          emissiveIntensity={1.65}
          roughness={0.42}
          metalness={0.05}
        />
      </mesh>
      <mesh position={[0, 0.205, -0.02]}>
        <boxGeometry args={[1.34, 0.012, 0.94]} />
        <meshStandardMaterial color="#1e1a17" roughness={0.7} metalness={0.2} />
      </mesh>
      <pointLight position={[0, 0.55, 0]} intensity={2.8} distance={3.6} color={DR_COLORS.spot} />
    </group>
  )
}
