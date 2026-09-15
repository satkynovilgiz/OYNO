import * as THREE from 'three';
import { useMemo } from 'react';

import { BozUy, Bush, Flag, JailooTerrain, KyrgyzSky, MountainBackdrop, RockCluster, SceneLighting } from '../../shared/environment';
import { scenePalette } from '../../shared/scenePalette';
import { ORDO_FIELD_RADIUS } from './OrdoTypes';

/** Ordo's own environment dressing - a circular boundary ring on the
 * ground and a small festival-ground scatter of boz üйлөр, on top of the
 * shared jailoo pieces (Section "Do not make every game visually
 * identical"). */
export function OrdoField() {
  const ringGeometry = useMemo(() => new THREE.RingGeometry(ORDO_FIELD_RADIUS - 0.06, ORDO_FIELD_RADIUS, 64), []);
  const innerFieldGeometry = useMemo(() => new THREE.CircleGeometry(ORDO_FIELD_RADIUS - 0.06, 64), []);

  return (
    <>
      <KyrgyzSky />
      <SceneLighting />
      <MountainBackdrop />
      <JailooTerrain />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} geometry={innerFieldGeometry}>
        <meshStandardMaterial color={scenePalette.dirt} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} geometry={ringGeometry}>
        <meshStandardMaterial color={scenePalette.gold} roughness={0.8} />
      </mesh>

      <BozUy position={[6, 0, -6]} />
      <BozUy position={[-7, 0, -5]} />

      {/* Four marker flags just outside the play ring (Section
       * "flags/banners" / "better scene composition") - frame the
       * traditional open playing area without encroaching on it. */}
      <Flag position={[0, 0, -(ORDO_FIELD_RADIUS + 0.8)]} phase={0} />
      <Flag position={[0, 0, ORDO_FIELD_RADIUS + 0.8]} color={scenePalette.terracotta} phase={1.2} />
      <Flag position={[ORDO_FIELD_RADIUS + 0.8, 0, 0]} phase={2.4} />
      <Flag position={[-(ORDO_FIELD_RADIUS + 0.8), 0, 0]} color={scenePalette.terracotta} phase={3.6} />

      <RockCluster position={[8.5, 0, 4]} seed={3} count={3} />
      <Bush position={[-8, 0, 3.5]} seed={4} />
      <Bush position={[7.5, 0, -8]} seed={7} scale={1.15} />
    </>
  );
}
