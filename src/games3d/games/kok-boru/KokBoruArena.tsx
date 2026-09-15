import { useMemo } from 'react';
import * as THREE from 'three';

import { BozUy, Bush, Flag, JailooTerrain, KyrgyzSky, MountainBackdrop, RockCluster, SceneLighting } from '../../shared/environment';
import { scenePalette } from '../../shared/scenePalette';
import { AI_GOAL, GOAL_RADIUS_M, OBJECT_SPAWN, PLAYER_GOAL } from './KokBoruTypes';

function GoalMarker({ position, ringColor }: { position: { x: number; z: number }; ringColor: string }) {
  const goalRingGeometry = useMemo(() => new THREE.RingGeometry(GOAL_RADIUS_M - 0.08, GOAL_RADIUS_M, 48), []);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[position.x, 0.006, position.z]} geometry={goalRingGeometry}>
        <meshStandardMaterial color={ringColor} roughness={0.8} />
      </mesh>
      <Flag position={[position.x - GOAL_RADIUS_M - 0.3, 0, position.z]} height={2} color={ringColor} phase={0} />
      <Flag position={[position.x + GOAL_RADIUS_M + 0.3, 0, position.z]} height={2} color={ringColor} phase={1.8} />
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

      {/* Sideline rocks/scrub (Section "rocks" / "simple vegetation") -
       * placed outside PLAYER_GOAL/AI_GOAL/OBJECT_SPAWN and the riding
       * lane between them, purely field-edge dressing for the larger
       * competitive-field identity. */}
      <RockCluster position={[9, 0, -4]} seed={21} count={3} />
      <RockCluster position={[-9, 0, 8]} seed={25} count={3} />
      <Bush position={[8.5, 0, -12]} seed={23} scale={1.2} />
      <Bush position={[-8, 0, 2]} seed={27} />
    </>
  );
}
