import { useMemo } from 'react';
import * as THREE from 'three';

import { scenePalette } from '../scenePalette';

type Peak = { x: number; z: number; height: number; radius: number };

function makeRow(count: number, z: number, baseHeight: number, seed: number): Peak[] {
  const peaks: Peak[] = [];
  for (let i = 0; i < count; i += 1) {
    // Deterministic pseudo-variation (no Math.random) so the layout is
    // stable across renders/re-mounts instead of reshuffling every time.
    const wobble = Math.sin(i * 12.9898 + seed * 78.233) * 0.5 + 0.5;
    peaks.push({
      x: (i - count / 2) * 14 + wobble * 6,
      z,
      height: baseHeight * (0.7 + wobble * 0.6),
      radius: 8 + wobble * 4,
    });
  }
  return peaks;
}

/** Layered low-poly mountain silhouettes (Section 10) - three depth bands
 * using flat-shaded cones, cheapest possible geometry for a "jailoo ringed
 * by mountains" backdrop (Section 9). Placeholder geometry, not sourced
 * terrain data (Section 12). */
export function MountainBackdrop() {
  const rows = useMemo(
    () => [
      { peaks: makeRow(7, -70, 26, 1), color: scenePalette.mountainFar },
      { peaks: makeRow(6, -50, 20, 2), color: scenePalette.mountainMid },
      { peaks: makeRow(5, -34, 14, 3), color: scenePalette.mountainNear },
    ],
    [],
  );

  return (
    <group>
      {rows.map((row, rowIndex) => (
        <group key={rowIndex}>
          {row.peaks.map((peak, i) => (
            <mesh key={i} position={[peak.x, peak.height / 2 - 1, peak.z]}>
              <coneGeometry args={[peak.radius, peak.height, 4]} />
              <meshStandardMaterial color={row.color} flatShading roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
