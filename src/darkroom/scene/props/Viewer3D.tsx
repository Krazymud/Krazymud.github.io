import * as THREE from 'three'

export function Viewer3D() {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, -0.12, 0]}>
        <boxGeometry args={[0.52, 0.18, 0.42]} />
        <meshStandardMaterial color="#3a3a3e" roughness={0.42} metalness={0.72} />
      </mesh>
      <mesh castShadow position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.19, 0.22, 0.32, 36]} />
        <meshStandardMaterial color="#5c5c60" roughness={0.28} metalness={0.82} />
      </mesh>
      <mesh position={[0, 0.06, 0.17]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.13, 0.14, 36]} />
        <meshPhysicalMaterial
          color="#0c1218"
          roughness={0.04}
          metalness={0.25}
          clearcoat={1}
          clearcoatRoughness={0.08}
          ior={1.52}
        />
      </mesh>
      <mesh position={[0, 0.06, 0.24]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.08, 0.115, 36]} />
        <meshStandardMaterial color="#888" roughness={0.2} metalness={0.9} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
