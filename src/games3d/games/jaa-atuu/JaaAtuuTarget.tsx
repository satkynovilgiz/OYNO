import * as THREE from 'three';

import { scenePalette } from '../../shared/scenePalette';
import { JAA_ATUU_RINGS, TARGET_HEIGHT_M } from './JaaAtuuTypes';

type JaaAtuuTargetProps = {
  center: THREE.Vector3;
};

/** Concentric scoring rings (Section 25) rendered as stacked flat circles,
 * largest-and-farthest first so each smaller ring layers visibly in front
 * without z-fighting. Score is computed from radial distance in
 * JaaAtuuBallistics.resolveImpact, not from this material/texture. */
export function JaaAtuuTarget({ center }: JaaAtuuTargetProps) {
  const sortedRings = [...JAA_ATUU_RINGS].sort((a, b) => b.radius - a.radius);

  return (
    <group position={[center.x, center.y, center.z]}>
      {sortedRings.map((ring, index) => (
        <mesh key={ring.id} position={[0, 0, index * 0.01]} castShadow>
          <circleGeometry args={[ring.radius, 32]} />
          <meshStandardMaterial color={ring.color} roughness={0.85} />
        </mesh>
      ))}

      {/* Backing board, slightly behind the rings */}
      <mesh position={[0, 0, -0.03]}>
        <circleGeometry args={[1.12, 32]} />
        <meshStandardMaterial color={scenePalette.wood} roughness={1} />
      </mesh>

      {/* Simple A-frame stand */}
      <mesh position={[-0.55, -TARGET_HEIGHT_M / 2 - 0.3, -0.15]} rotation={[0, 0, 0.25]}>
        <boxGeometry args={[0.08, TARGET_HEIGHT_M + 0.6, 0.08]} />
        <meshStandardMaterial color={scenePalette.dirt} roughness={1} />
      </mesh>
      <mesh position={[0.55, -TARGET_HEIGHT_M / 2 - 0.3, -0.15]} rotation={[0, 0, -0.25]}>
        <boxGeometry args={[0.08, TARGET_HEIGHT_M + 0.6, 0.08]} />
        <meshStandardMaterial color={scenePalette.dirt} roughness={1} />
      </mesh>
    </group>
  );
}
