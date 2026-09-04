import { forwardRef } from 'react';
import * as THREE from 'three';

import { scenePalette } from '../../shared/scenePalette';

/** Placeholder arrow geometry (Section 12) - shaft + tip + fletching built
 * from primitives, no GLB yet. Points along local -Z so the parent group can
 * orient it with `quaternion.setFromUnitVectors(FORWARD, velocityDir)`. */
export const ARROW_FORWARD = new THREE.Vector3(0, 0, -1);

export const JaaAtuuArrow = forwardRef<THREE.Group>(function JaaAtuuArrow(_props, ref) {
  return (
    <group ref={ref}>
      <mesh position={[0, 0, -0.3]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.6, 6]} />
        <meshStandardMaterial color={scenePalette.wood} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, -0.62]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.02, 0.06, 6]} />
        <meshStandardMaterial color="#4A4A4A" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <coneGeometry args={[0.03, 0.08, 4]} />
        <meshStandardMaterial color={scenePalette.fletching} roughness={0.9} />
      </mesh>
    </group>
  );
});
