import { forwardRef } from 'react';
import * as THREE from 'three';

import { scenePalette } from '../../shared/scenePalette';

type ChukoPieceProps = {
  isStriker?: boolean;
};

/** Placeholder chuko (astragalus) piece (Section 11/12) - an irregular
 * knuckle-bone shape approximated with a stretched, slightly asymmetric
 * box rather than a perfect primitive, so it doesn't read as a generic
 * die. The striker gets a gold accent band. */
export const ChukoPiece = forwardRef<THREE.Group, ChukoPieceProps>(function ChukoPiece({ isStriker }, ref) {
  const color = isStriker ? scenePalette.terracotta : '#EDE0C8';

  return (
    <group ref={ref}>
      <mesh castShadow>
        <boxGeometry args={[0.16, 0.09, 0.11]} />
        <meshStandardMaterial color={color} roughness={0.75} />
      </mesh>
      <mesh position={[0.03, 0.02, 0]} castShadow>
        <boxGeometry args={[0.08, 0.07, 0.09]} />
        <meshStandardMaterial color={color} roughness={0.75} />
      </mesh>
      {isStriker ? (
        <mesh position={[0, 0.055, 0]}>
          <boxGeometry args={[0.17, 0.006, 0.12]} />
          <meshBasicMaterial color={scenePalette.gold} />
        </mesh>
      ) : null}
    </group>
  );
});
