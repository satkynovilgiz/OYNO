import { forwardRef } from 'react';
import * as THREE from 'three';

import { scenePalette } from '../../shared/scenePalette';

/** Placeholder ulak (Section 11/12) - represented abstractly as a bound
 * cloth bundle rather than anything literal/graphic, appropriate for an
 * all-ages app while still reading as "the object being carried". */
export const KokBoruObject = forwardRef<THREE.Group>(function KokBoruObject(_props, ref) {
  return (
    <group ref={ref}>
      <mesh castShadow position={[0, 0.18, 0]}>
        <sphereGeometry args={[0.22, 12, 10]} />
        <meshStandardMaterial color={scenePalette.wood} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.02, 6, 16]} />
        <meshStandardMaterial color={scenePalette.gold} roughness={0.7} />
      </mesh>
    </group>
  );
});
