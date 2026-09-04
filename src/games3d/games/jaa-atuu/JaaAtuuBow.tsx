import { forwardRef } from 'react';
import * as THREE from 'three';

import { scenePalette } from '../../shared/scenePalette';
import { ARCHER_POSITION } from './JaaAtuuBallistics';

/** Placeholder over-the-shoulder bow (Section 12/27) - a half-torus limb and
 * a string. The parent scene drives the string's pull-back distance by
 * mutating the forwarded group's `position.z` directly inside useFrame
 * (Section 86/87) instead of passing a `drawAmount` prop through React
 * state, which would re-render this subtree up to 60x/sec while drawing. */
export const JaaAtuuBow = forwardRef<THREE.Group>(function JaaAtuuBow(_props, stringRef) {
  const basePosition: [number, number, number] = [
    ARCHER_POSITION.x + 0.22,
    ARCHER_POSITION.y - 0.18,
    ARCHER_POSITION.z - 0.55,
  ];

  return (
    <group position={basePosition}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <torusGeometry args={[0.32, 0.014, 8, 24, Math.PI * 1.15]} />
        <meshStandardMaterial color={scenePalette.wood} roughness={0.6} />
      </mesh>

      <group ref={stringRef}>
        <mesh position={[0, 0.28, 0]}>
          <cylinderGeometry args={[0.003, 0.003, 0.02, 4]} />
          <meshBasicMaterial color="#EDEDED" />
        </mesh>
        <mesh position={[0, -0.28, 0]}>
          <cylinderGeometry args={[0.003, 0.003, 0.02, 4]} />
          <meshBasicMaterial color="#EDEDED" />
        </mesh>
      </group>
    </group>
  );
});
