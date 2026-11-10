export function Tray3D() {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.04, 0]}>
        <boxGeometry args={[1.22, 0.055, 0.82]} />
        <meshStandardMaterial color="#6b7378" roughness={0.32} metalness={0.78} />
      </mesh>
      <mesh position={[0, 0.072, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.06, 0.66]} />
        <meshPhysicalMaterial
          color="#1a100c"
          roughness={0.08}
          metalness={0.15}
          transmission={0.35}
          thickness={0.08}
          ior={1.42}
          transparent
          opacity={0.88}
          clearcoat={0.6}
          clearcoatRoughness={0.15}
        />
      </mesh>
      {([-0.31, 0.31] as const).map((z) => (
        <mesh key={z} castShadow position={[0, 0.095, z]}>
          <boxGeometry args={[1.22, 0.05, 0.035]} />
          <meshStandardMaterial color="#5a6166" roughness={0.35} metalness={0.75} />
        </mesh>
      ))}
    </group>
  )
}
