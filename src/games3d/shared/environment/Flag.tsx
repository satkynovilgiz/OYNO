import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { scenePalette } from '../scenePalette';

type FlagProps = {
  position: [number, number, number];
  color?: string;
  height?: number;
  /** Staggers each flag's sway phase (Section "subtle environmental
   * movement where cheap") so a row of flags doesn't wave in unison like
   * one object copy-pasted - purely a starting-phase offset, not a
   * per-flag simulation. */
  phase?: number;
};

/** Pole + banner (Section "flags/banners") - the banner is a single flat
 * plane whose whole mesh gently rocks in `useFrame` (not per-vertex cloth
 * simulation) for a cheap "waving in the wind" read. Reused across every
 * game's field dressing rather than each game inventing its own flag. */
export function Flag({ position, color = scenePalette.gold, height = 1.4, phase = 0 }: FlagProps) {
  const bannerRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!bannerRef.current) return;
    const t = state.clock.elapsedTime * 2.4 + phase;
    bannerRef.current.rotation.y = Math.sin(t) * 0.35;
    bannerRef.current.rotation.z = Math.sin(t * 1.3) * 0.06;
  });

  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.03, height, 6]} />
        <meshStandardMaterial color={scenePalette.wood} roughness={0.85} />
      </mesh>
      <mesh ref={bannerRef} position={[0.22, height - 0.22, 0]}>
        <planeGeometry args={[0.44, 0.3]} />
        <meshStandardMaterial color={color} roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
