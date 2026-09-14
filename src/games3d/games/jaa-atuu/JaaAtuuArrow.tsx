import { forwardRef } from 'react';
import * as THREE from 'three';

import { scenePalette } from '../../shared/scenePalette';

/** Placeholder arrow geometry (Section 12) - shaft + tip + fletching built
 * from primitives, no GLB yet. Points along local -Z so the parent group can
 * orient it with `quaternion.setFromUnitVectors(FORWARD, velocityDir)`. */
export const ARROW_FORWARD = new THREE.Vector3(0, 0, -1);

const FLETCH_ANGLES = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];

export const JaaAtuuArrow = forwardRef<THREE.Group>(function JaaAtuuArrow(_props, ref) {
  return (
    <group ref={ref}>
      {/* Shaft - a cylinder is Y-axis-long by default; without this
          rotation it stood vertical instead of running along the arrow's
          own -Z forward axis (same fix shape as the horse-body capsule
          bug), leaving the tip/fletching below correctly angled around a
          shaft that didn't actually connect them. */}
      <mesh position={[0, 0, -0.3]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.6, 6]} />
        <meshStandardMaterial color={scenePalette.wood} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, -0.62]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.02, 0.06, 6]} />
        <meshStandardMaterial color="#4A4A4A" metalness={0.4} roughness={0.4} />
      </mesh>

      {/* Fletching - 3 flat fins fanned around the tail instead of one
          cone standing in for feathers. */}
      {FLETCH_ANGLES.map((angle) => (
        <group key={angle} rotation={[0, 0, angle]}>
          <mesh position={[0, 0.037, 0.02]} castShadow>
            <boxGeometry args={[0.003, 0.05, 0.09]} />
            <meshStandardMaterial color={scenePalette.fletching} roughness={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
});
