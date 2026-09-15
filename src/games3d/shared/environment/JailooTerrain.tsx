import { useMemo } from 'react';
import * as THREE from 'three';

import { scenePalette } from '../scenePalette';

type JailooTerrainProps = {
  size?: number;
};

/** Flat grass ground plane (Section 10) - a single low-poly plane, no
 * per-blade grass geometry (Section 57 - don't shadow every grass blade;
 * here there simply isn't per-blade geometry to shadow). Vertex-colored
 * with a deterministic patchy blend of grass/grassShadow (Section "better
 * grass/ground") instead of one flat color - same triangle count as
 * before, just a per-vertex color attribute, so it's free at render time. */
export function JailooTerrain({ size = 120 }: JailooTerrainProps) {
  const geometry = useMemo(() => {
    const segments = 24;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    const base = new THREE.Color(scenePalette.grass);
    const shadow = new THREE.Color(scenePalette.grassShadow);
    const position = geo.attributes.position;
    const colors: number[] = [];

    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const y = position.getY(i);
      const patch =
        Math.sin(x * 0.18 + 4.1) * Math.cos(y * 0.21 + 1.7) * 0.5 +
        Math.sin(x * 0.05 - y * 0.07) * 0.5;
      const t = THREE.MathUtils.clamp(patch * 0.5 + 0.5, 0, 1) * 0.35;
      const mixed = base.clone().lerp(shadow, t);
      colors.push(mixed.r, mixed.g, mixed.b);
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, [size]);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} />
    </mesh>
  );
}
