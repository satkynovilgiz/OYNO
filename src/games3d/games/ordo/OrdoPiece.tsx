import { forwardRef } from 'react';
import * as THREE from 'three';

import { scenePalette } from '../../shared/scenePalette';
import type { OrdoPieceKind } from './OrdoTypes';

type OrdoPieceProps = {
  kind: OrdoPieceKind;
  isStriker?: boolean;
};

/** Placeholder chuko/khan piece geometry (Section 11/12) - the khan is a
 * visibly distinct wider gold disc (Section "core rule": made from an old
 * coin/tin, visually distinct from bone chuko pieces); the striker (the
 * player's/AI's own thrown piece) gets a lighter accent ring so it reads as
 * "your piece" mid-flight. */
export const OrdoPiece = forwardRef<THREE.Group, OrdoPieceProps>(function OrdoPiece({ kind, isStriker }, ref) {
  const isKhan = kind === 'khan';
  const radius = isKhan ? 0.22 : isStriker ? 0.18 : 0.16;
  const height = isKhan ? 0.12 : 0.14;
  const color = isKhan ? scenePalette.gold : isStriker ? scenePalette.terracotta : '#E4D9C4';

  return (
    <group ref={ref}>
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius * 0.85, height, isKhan ? 20 : 8]} />
        <meshStandardMaterial color={color} roughness={isKhan ? 0.35 : 0.8} metalness={isKhan ? 0.4 : 0} />
      </mesh>
      {isStriker ? (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, height / 2 + 0.005]}>
          <ringGeometry args={[radius * 0.7, radius * 0.85, 16]} />
          <meshBasicMaterial color={scenePalette.gold} />
        </mesh>
      ) : null}
    </group>
  );
});
