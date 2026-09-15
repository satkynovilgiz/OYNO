import { useMemo } from 'react';
import * as THREE from 'three';

import { BozUy, JailooTerrain, KyrgyzSky, MountainBackdrop, SceneLighting } from '../../shared/environment';
import { scenePalette } from '../../shared/scenePalette';
import { AI_GOAL, GOAL_RADIUS_M, OBJECT_SPAWN, PLAYER_GOAL } from './KokBoruTypes';

function GoalMarker({ position, ringColor }: { position: { x: number; z: number }; ringColor: string }) {
  const goalRingGeometry = useMemo(() => new THREE.RingGeometry(GOAL_RADIUS_M - 0.08, GOAL_RADIUS_M, 48), []);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[position.x, 0.006, position.z]} geometry={goalRingGeometry}>
        <meshStandardMaterial color={ringColor} roughness={0.8} />
      </mesh>
      <mesh position={[position.x - GOAL_RADIUS_M - 0.3, 1, position.z]}>
        <cylinderGeometry args={[0.04, 0.04, 2, 6]} />
        <meshStandardMaterial color={scenePalette.wood} roughness={0.9} />
      </mesh>
      <mesh position={[position.x + GOAL_RADIUS_M + 0.3, 1, position.z]}>
        <cylinderGeometry args={[0.04, 0.04, 2, 6]} />
        <meshStandardMaterial color={scenePalette.wood} roughness={0.9} />
      </mesh>
    </>
  );
}

/** Kok Boru's competition field (Section 44) - two goals now (Section
 * "KOK BORU 1V1": one per side), kept compact/manageable for a 1v1 slice
 * rather than the full-size arena a multi-rider match would need. */
export function KokBoruArena() {
  const centerMarkGeometry = useMemo(() => new THREE.RingGeometry(0.6, 0.7, 32), []);

  return (
    <>
      <KyrgyzSky />
      <SceneLighting />
      <MountainBackdrop />
      <JailooTerrain size={200} />

      {/* Player's goal (gold) and the AI's goal (terracotta) at opposite
          ends of the field, so which ring belongs to which side reads at a
          glance rather than needing a HUD label to tell them apart. */}
      <GoalMarker position={PLAYER_GOAL} ringColor={scenePalette.gold} />
      <GoalMarker position={AI_GOAL} ringColor={scenePalette.terracotta} />

      {/* Object spawn marker */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[OBJECT_SPAWN.x, 0.005, OBJECT_SPAWN.z]} geometry={centerMarkGeometry}>
        <meshStandardMaterial color={scenePalette.dirt} roughness={1} />
      </mesh>

      <BozUy position={[7, 0, 4]} />
      <BozUy position={[-7, 0, -10]} />
    </>
  );
}
