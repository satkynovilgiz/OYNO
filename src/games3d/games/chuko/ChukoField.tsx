import { useMemo } from 'react';
import * as THREE from 'three';

import { JailooTerrain, KyrgyzSky, MountainBackdrop, SceneLighting } from '../../shared/environment';
import { scenePalette } from '../../shared/scenePalette';
import { CHUKO_FIELD_RADIUS } from './ChukoTypes';

/** Chuko's own dressing - a small woven-rug-style courtyard patch instead
 * of Ordo's big siege field, since chuko is a close, ground-level game
 * (Section "CHUKO — VISUAL STYLE": "close physical 3D game... traditional
 * courtyard"). Reuses the shared jailoo backdrop so it still feels like the
 * same OYNO world (Section "Do not make every game visually identical" -
 * different foreground, same universe). */
export function ChukoField() {
  const matGeometry = useMemo(() => new THREE.CircleGeometry(CHUKO_FIELD_RADIUS, 48), []);
  const borderGeometry = useMemo(() => new THREE.RingGeometry(CHUKO_FIELD_RADIUS - 0.05, CHUKO_FIELD_RADIUS, 48), []);

  return (
    <>
      <KyrgyzSky />
      <SceneLighting />
      <MountainBackdrop />
      <JailooTerrain />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} geometry={matGeometry}>
        <meshStandardMaterial color={scenePalette.terracotta} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} geometry={borderGeometry}>
        <meshStandardMaterial color={scenePalette.wood} roughness={0.9} />
      </mesh>
    </>
  );
}
