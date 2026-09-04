import * as THREE from 'three';
import { useMemo } from 'react';

import { BozUy, JailooTerrain, KyrgyzSky, MountainBackdrop, SceneLighting } from '../../shared/environment';
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
    </>
  );
}
