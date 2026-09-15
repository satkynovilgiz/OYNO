import { scenePalette } from '../scenePalette';

/** Simple boz-uy placeholder (Section 11/12) - a cone + short cylinder
 * base, cheap enough to scatter for festival/course dressing across
 * multiple games. A felt trim band and a dark doorway recess (Section
 * "better scene composition") are added as thin extra primitives, not a
 * geometry rebuild, so it still reads as a boz-uy at a glance rather than
 * a plain cone-on-cylinder. */
export function BozUy({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.9, 1, 0.8, 12]} />
        <meshStandardMaterial color={scenePalette.terracotta} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.76, 0]}>
        <cylinderGeometry args={[0.92, 0.92, 0.12, 12]} />
        <meshStandardMaterial color={scenePalette.felt} roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.0, 0]} castShadow>
        <coneGeometry args={[0.9, 0.7, 12]} />
        <meshStandardMaterial color={scenePalette.wood} roughness={1} />
      </mesh>
      <mesh position={[0, 0.32, 0.99]}>
        <planeGeometry args={[0.34, 0.62]} />
        <meshStandardMaterial color="#2A1D12" roughness={1} />
      </mesh>
      <mesh position={[0, 0.32, 0.985]}>
        <planeGeometry args={[0.4, 0.06]} />
        <meshStandardMaterial color={scenePalette.wood} roughness={0.9} />
      </mesh>
    </group>
  );
}
