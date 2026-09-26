import * as THREE from 'three';

import { scenePalette } from '../../shared/scenePalette';
import { JAA_ATUU_RINGS, TARGET_HEIGHT_M, type ArrowShot } from './JaaAtuuTypes';

type JaaAtuuTargetProps = {
  center: THREE.Vector3;
  /** Resolved shots this round; each hit is drawn as an arrow stuck in
   * the face at its exact scored offset (misses have no offset). */
  hits?: ArrowShot[];
};

const STUCK_SHAFT_LENGTH = 0.55;

/** Concentric scoring rings (Section 25) rendered as stacked flat circles,
 * largest-and-farthest first so each smaller ring layers visibly in front
 * without z-fighting. Score is computed from radial distance in
 * JaaAtuuBallistics.resolveImpact, not from this material/texture. */
export function JaaAtuuTarget({ center, hits = [] }: JaaAtuuTargetProps) {
  const sortedRings = [...JAA_ATUU_RINGS].sort((a, b) => b.radius - a.radius);

  return (
    <group position={[center.x, center.y, center.z]}>
      {sortedRings.map((ring, index) => (
        <mesh key={ring.id} position={[0, 0, index * 0.01]} castShadow>
          <circleGeometry args={[ring.radius, 32]} />
          <meshStandardMaterial color={ring.color} roughness={0.85} />
        </mesh>
      ))}

      {/* Arrows stuck where they scored - the newest one is gold-fletched so
          the latest hit is easy to find. Same offsets the score used. */}
      {hits.map((hit, index) =>
        hit.hitOffset ? (
          <group key={index} position={[hit.hitOffset.x, hit.hitOffset.y, 0.05 + STUCK_SHAFT_LENGTH / 2]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.012, 0.012, STUCK_SHAFT_LENGTH, 6]} />
              <meshStandardMaterial color={scenePalette.wood} roughness={0.8} />
            </mesh>
            <mesh position={[0, 0, STUCK_SHAFT_LENGTH / 2 - 0.04]}>
              <boxGeometry args={[0.07, 0.07, 0.08]} />
              <meshStandardMaterial color={index === hits.length - 1 ? '#E8B93D' : '#F3E5C9'} roughness={0.9} />
            </mesh>
          </group>
        ) : null,
      )}

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
