import { useMemo } from 'react';

import { scenePalette } from '../scenePalette';

type BushProps = {
  position: [number, number, number];
  seed?: number;
  scale?: number;
};

/** Simple vegetation (Section "simple vegetation") - a small cluster of
 * overlapping low-poly spheres reads as a stylized bush at a fraction of
 * the cost of any per-leaf/per-blade geometry, matching the flat-shaded
 * low-poly language MountainBackdrop.tsx already established. */
export function Bush({ position, seed = 0, scale = 1 }: BushProps) {
  const lobes = useMemo(() => {
    return Array.from({ length: 3 }, (_, i) => {
      const wobble = Math.sin(i * 12.9898 + seed * 78.233) * 0.5 + 0.5;
      const angle = (i / 3) * Math.PI * 2;
      return {
        x: Math.cos(angle) * 0.18,
        z: Math.sin(angle) * 0.18,
        radius: 0.22 + wobble * 0.1,
      };
    });
  }, [seed]);

  return (
    <group position={position} scale={scale}>
      {lobes.map((lobe, i) => (
        <mesh key={i} position={[lobe.x, lobe.radius * 0.8, lobe.z]} castShadow>
          <icosahedronGeometry args={[lobe.radius, 0]} />
          <meshStandardMaterial color={scenePalette.grass} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}
