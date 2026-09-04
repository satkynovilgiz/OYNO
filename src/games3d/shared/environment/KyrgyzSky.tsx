import { useMemo } from 'react';
import * as THREE from 'three';

import { scenePalette } from '../scenePalette';

/** Cheap stylized sky dome (Section 10/59) - a two-color vertical gradient
 * baked into vertex colors on a large inverted sphere, plus scene fog for
 * depth. Deliberately not a physically-based sky shader: this is placeholder
 * geometry (Section 12) chosen for mobile GPU cost, not realism. */
export function KyrgyzSky() {
  const geometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(90, 24, 16);
    const top = new THREE.Color(scenePalette.skyTop);
    const horizon = new THREE.Color(scenePalette.skyHorizon);
    const colors: number[] = [];
    const position = geo.attributes.position;

    for (let i = 0; i < position.count; i += 1) {
      const y = position.getY(i);
      const t = THREE.MathUtils.clamp(y / 90, -0.15, 1);
      const mixed = horizon.clone().lerp(top, Math.max(0, t));
      colors.push(mixed.r, mixed.g, mixed.b);
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, []);

  return (
    <>
      <fog attach="fog" args={[scenePalette.skyHorizon, 40, 110]} />
      <mesh geometry={geometry}>
        <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} />
      </mesh>
    </>
  );
}
