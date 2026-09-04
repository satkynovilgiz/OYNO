import { scenePalette } from '../scenePalette';

type JailooTerrainProps = {
  size?: number;
};

/** Flat grass ground plane (Section 10) - a single low-poly plane, no
 * per-blade grass geometry (Section 57 - don't shadow every grass blade;
 * here there simply isn't per-blade geometry to shadow). */
export function JailooTerrain({ size = 120 }: JailooTerrainProps) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial color={scenePalette.grass} roughness={1} />
    </mesh>
  );
}
