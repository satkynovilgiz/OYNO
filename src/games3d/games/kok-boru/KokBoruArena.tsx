import { useMemo } from 'react';
import * as THREE from 'three';

import { BozUy, JailooTerrain, KyrgyzSky, MountainBackdrop, SceneLighting } from '../../shared/environment';
import { scenePalette } from '../../shared/scenePalette';
import { GOAL_POSITION, GOAL_RADIUS_M, OBJECT_SPAWN } from './KokBoruTypes';

/** Kok Boru's competition field (Section 44) - kept compact/manageable for
 * this Phase A slice (one player, one goal), not the full-size arena a
 * multi-rider match would need. */
export function KokBoruArena() {
  const goalRingGeometry = useMemo(() => new THREE.RingGeometry(GOAL_RADIUS_M - 0.08, GOAL_RADIUS_M, 48), []);
  const centerMarkGeometry = useMemo(() => new THREE.RingGeometry(0.6, 0.7, 32), []);

  return (
    <>
      <KyrgyzSky />
      <SceneLighting />
      <MountainBackdrop />
      <JailooTerrain size={200} />

      {/* Goal circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[GOAL_POSITION.x, 0.006, GOAL_POSITION.z]} geometry={goalRingGeometry}>
        <meshStandardMaterial color={scenePalette.gold} roughness={0.8} />
      </mesh>
      <mesh position={[GOAL_POSITION.x - GOAL_RADIUS_M - 0.3, 1, GOAL_POSITION.z]}>
        <cylinderGeometry args={[0.04, 0.04, 2, 6]} />
        <meshStandardMaterial color={scenePalette.wood} roughness={0.9} />
      </mesh>
      <mesh position={[GOAL_POSITION.x + GOAL_RADIUS_M + 0.3, 1, GOAL_POSITION.z]}>
        <cylinderGeometry args={[0.04, 0.04, 2, 6]} />
        <meshStandardMaterial color={scenePalette.wood} roughness={0.9} />
      </mesh>

      {/* Object spawn marker */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[OBJECT_SPAWN.x, 0.005, OBJECT_SPAWN.z]} geometry={centerMarkGeometry}>
        <meshStandardMaterial color={scenePalette.dirt} roughness={1} />
      </mesh>

      <BozUy position={[7, 0, 4]} />
      <BozUy position={[-7, 0, -10]} />
    </>
  );
}
