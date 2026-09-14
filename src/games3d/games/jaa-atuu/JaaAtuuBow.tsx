import { forwardRef, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';

import { scenePalette } from '../../shared/scenePalette';
import { ARCHER_POSITION } from './JaaAtuuBallistics';

export type JaaAtuuBowHandle = {
  /** The two string segments (limb tip -> the moving nock point) - the
   * parent scene's useFrame re-poses both every frame from the current
   * draw `pull` (Section 86/87: refs, not React state, so a held draw
   * doesn't re-render this subtree at 60fps). */
  topString: THREE.Mesh | null;
  bottomString: THREE.Mesh | null;
};

const TIP_Y = 0.3;
const TIP_Z = -0.03;

/** Recurve-style bow (Section 12/27): a riser (grip) with two tapered
 * limbs arcing out to nock tips, and a real two-segment string that bends
 * toward a single moving nock point instead of the whole string
 * translating as one rigid unit (which would visually detach it from the
 * limb tips while drawing). The limb tips stay fixed; only the string
 * segments themselves are re-posed. */
export const JaaAtuuBow = forwardRef<JaaAtuuBowHandle>(function JaaAtuuBow(_props, ref) {
  const topStringRef = useRef<THREE.Mesh>(null);
  const bottomStringRef = useRef<THREE.Mesh>(null);

  useImperativeHandle(ref, () => ({
    get topString() {
      return topStringRef.current;
    },
    get bottomString() {
      return bottomStringRef.current;
    },
  }));

  const basePosition: [number, number, number] = [
    ARCHER_POSITION.x + 0.22,
    ARCHER_POSITION.y - 0.18,
    ARCHER_POSITION.z - 0.55,
  ];

  return (
    <group position={basePosition}>
      {/* Riser / grip */}
      <mesh castShadow>
        <boxGeometry args={[0.03, 0.14, 0.035]} />
        <meshStandardMaterial color={scenePalette.wood} roughness={0.55} />
      </mesh>

      {/* Limbs - tapered cylinders angled slightly back from the riser to
          the nock tips, instead of one uniform-width arc. */}
      <mesh position={[0, 0.18, -0.015]} rotation={[-0.13, 0, 0]} castShadow>
        <cylinderGeometry args={[0.006, 0.014, 0.24, 8]} />
        <meshStandardMaterial color={scenePalette.wood} roughness={0.6} />
      </mesh>
      <mesh position={[0, -0.18, -0.015]} rotation={[0.13, 0, 0]} castShadow>
        <cylinderGeometry args={[0.014, 0.006, 0.24, 8]} />
        <meshStandardMaterial color={scenePalette.wood} roughness={0.6} />
      </mesh>

      {/* Nock tips - small caps marking where the string is anchored, so
          the string doesn't just end mid-air at the limb's raw edge. */}
      <mesh position={[0, TIP_Y, TIP_Z]}>
        <sphereGeometry args={[0.012, 6, 6]} />
        <meshBasicMaterial color="#EDEDED" />
      </mesh>
      <mesh position={[0, -TIP_Y, TIP_Z]}>
        <sphereGeometry args={[0.012, 6, 6]} />
        <meshBasicMaterial color="#EDEDED" />
      </mesh>

      {/* String segments - unit-height cylinders the parent scene scales
          and orients every frame to reach from each fixed tip to the
          shared moving nock point (see JaaAtuuScene.tsx). */}
      <mesh ref={topStringRef}>
        <cylinderGeometry args={[0.0025, 0.0025, 1, 4]} />
        <meshBasicMaterial color="#EDEDED" />
      </mesh>
      <mesh ref={bottomStringRef}>
        <cylinderGeometry args={[0.0025, 0.0025, 1, 4]} />
        <meshBasicMaterial color="#EDEDED" />
      </mesh>
    </group>
  );
});

export const BOW_STRING_TIP_Y = TIP_Y;
export const BOW_STRING_TIP_Z = TIP_Z;
