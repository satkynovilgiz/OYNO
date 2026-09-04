import { scenePalette } from '../scenePalette';

/** Simple boz-uy placeholder (Section 11/12) - a cone + short cylinder
 * base, cheap enough to scatter for festival/course dressing across
 * multiple games. */
export function BozUy({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.9, 1, 0.8, 12]} />
        <meshStandardMaterial color={scenePalette.terracotta} roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <coneGeometry args={[0.9, 0.7, 12]} />
        <meshStandardMaterial color={scenePalette.wood} roughness={1} />
      </mesh>
    </group>
  );
}
