import { useFrame } from '@react-three/fiber';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';

import { scenePalette } from '../scenePalette';
import { CharacterHair } from './CharacterHair';
import { CharacterHead } from './CharacterHead';
import type { CharacterExpression, CharacterVariant } from './CharacterTypes';

export type CharacterHandle = {
  root: THREE.Group | null;
  head: THREE.Group | null;
  leftShoulder: THREE.Group | null;
  rightShoulder: THREE.Group | null;
};

type CharacterModelProps = {
  variant: CharacterVariant;
  expression?: CharacterExpression;
  /** Idle breathing/weight-shift bob (Section 7 - "do not let player remain
   * frozen"). Disable for a rider already animated by the horse's own gait
   * (Section "KYZ KUUMAI/KOK BORU"), where a second independent bob would
   * fight the saddle attachment. */
  idleAnimation?: boolean;
};

const SKIN_ROUGHNESS = 0.85;

/** Procedural stylized humanoid (Section 3/6) - head/neck/torso/arms/hands/
 * legs/shoes with natural-ish proportions (not a Roblox block body, not a
 * floating head). Exposes `head`/`leftShoulder`/`rightShoulder` group refs
 * via `useImperativeHandle` so a game's own animation code (e.g. Jaa Atuu's
 * bow draw) can rotate specific joints directly in its own useFrame,
 * without this component needing to know about bows/reins/etc itself
 * (Section 13: "prepare architecture for reins if used later" - same
 * pattern). STATUS: STYLIZED_PROTOTYPE (Section 71). */
export const CharacterModel = forwardRef<CharacterHandle, CharacterModelProps>(function CharacterModel(
  { variant, expression = 'neutral', idleAnimation = true },
  ref,
) {
  const rootRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const leftShoulderRef = useRef<THREE.Group>(null);
  const rightShoulderRef = useRef<THREE.Group>(null);
  const phaseRef = useRef(Math.random() * Math.PI * 2);

  useImperativeHandle(ref, () => ({
    get root() {
      return rootRef.current;
    },
    get head() {
      return headRef.current;
    },
    get leftShoulder() {
      return leftShoulderRef.current;
    },
    get rightShoulder() {
      return rightShoulderRef.current;
    },
  }));

  useFrame((state) => {
    if (!idleAnimation || !torsoRef.current) return;
    phaseRef.current = state.clock.elapsedTime * 1.6;
    torsoRef.current.position.y = 1.05 + Math.sin(phaseRef.current) * 0.006;
    if (headRef.current) headRef.current.rotation.z = Math.sin(phaseRef.current * 0.5) * 0.015;
  });

  const skin = variant.skinTone;
  const primary = variant.clothingPrimary;
  const secondary = variant.clothingSecondary;

  return (
    <group ref={rootRef}>
      {/* Legs + boots - a thigh/knee/shin split (not one straight cylinder)
          so the silhouette reads as a jointed leg even though nothing here
          actually bends it yet; a riding-boot shaft cuff in `secondary`
          ties the leg to the same trim color as the belt. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[0.07 * side, 0, 0]}>
          <mesh position={[0, 0.615, 0]} castShadow>
            <cylinderGeometry args={[0.056, 0.05, 0.38, 8]} />
            <meshStandardMaterial color={secondary} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.425, 0]} castShadow>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial color={secondary} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.255, 0]} castShadow>
            <cylinderGeometry args={[0.046, 0.04, 0.34, 8]} />
            <meshStandardMaterial color={secondary} roughness={0.9} />
          </mesh>
          {/* Boot shaft cuff, then the foot itself with a rounded toe cap
              instead of a bare box (Section: "not a Roblox block body"). */}
          <mesh position={[0, 0.11, 0]} castShadow>
            <cylinderGeometry args={[0.048, 0.044, 0.09, 8]} />
            <meshStandardMaterial color="#2B2019" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.05, 0.02]} castShadow>
            <boxGeometry args={[0.09, 0.06, 0.15]} />
            <meshStandardMaterial color="#2B2019" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.05, 0.095]} castShadow>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshStandardMaterial color="#2B2019" roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Torso */}
      <group ref={torsoRef} position={[0, 1.05, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.135, 0.155, 0.5, 10]} />
          <meshStandardMaterial color={primary} roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.24, 0]}>
          <cylinderGeometry args={[0.16, 0.155, 0.05, 10]} />
          <meshStandardMaterial color={secondary} roughness={0.8} />
        </mesh>
        {/* Belt buckle - a small dark accent so the hem band reads as a
            belt, not just a color change in the cylinder. */}
        <mesh position={[0, -0.24, 0.155]} castShadow>
          <boxGeometry args={[0.045, 0.035, 0.018]} />
          <meshStandardMaterial color="#2B2019" roughness={0.4} metalness={0.3} />
        </mesh>

        {/* Arms - each a rotatable shoulder group so callers can animate a
            draw/throw/wave without this component knowing why. Sleeve runs
            the full arm to a trim cuff at the wrist (matching the belt's
            `secondary` color) rather than stopping bare-skinned at the
            elbow, so the chapan reads as a full garment. */}
        <group ref={leftShoulderRef} position={[0.16, 0.2, 0]}>
          <mesh position={[0, -0.15, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.028, 0.3, 8]} />
            <meshStandardMaterial color={primary} roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.305, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, 0.02, 8]} />
            <meshStandardMaterial color={secondary} roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.34, 0]} castShadow>
            <sphereGeometry args={[0.028, 8, 8]} />
            <meshStandardMaterial color={skin} roughness={SKIN_ROUGHNESS} />
          </mesh>
        </group>
        <group ref={rightShoulderRef} position={[-0.16, 0.2, 0]}>
          <mesh position={[0, -0.15, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.028, 0.3, 8]} />
            <meshStandardMaterial color={primary} roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.305, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, 0.02, 8]} />
            <meshStandardMaterial color={secondary} roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.34, 0]} castShadow>
            <sphereGeometry args={[0.028, 8, 8]} />
            <meshStandardMaterial color={skin} roughness={SKIN_ROUGHNESS} />
          </mesh>
        </group>

        {/* Neck + head */}
        <mesh position={[0, 0.27, 0]}>
          <cylinderGeometry args={[0.035, 0.04, 0.08, 8]} />
          <meshStandardMaterial color={skin} roughness={SKIN_ROUGHNESS} />
        </mesh>
        <group ref={headRef} position={[0, 0.37, 0]}>
          <CharacterHead variant={variant} expression={expression} />
          <CharacterHair variant={variant} />
        </group>

        {/* Quiver - back-mounted (the character faces +Z locally, so -Z is
            the back), with a few arrow shafts peeking out so an archer
            preset reads as equipped even before a shot is nocked. Every
            CharacterModel consumer gets one today because the only current
            consumer is Jaa Atuu's archer (Section: "STATUS:
            STYLIZED_PROTOTYPE") - gate this behind a prop if a non-archer
            preset ever reuses this component. */}
        <group position={[-0.06, 0.04, -0.13]} rotation={[0.22, 0, 0.12]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.045, 0.055, 0.42, 8]} />
            <meshStandardMaterial color={secondary} roughness={0.85} />
          </mesh>
          {[-0.02, 0, 0.022].map((offset, i) => (
            <mesh key={i} position={[offset, 0.24, offset * 0.4]} rotation={[0, 0, offset * 2]} castShadow>
              <cylinderGeometry args={[0.007, 0.007, 0.2, 6]} />
              <meshStandardMaterial color={scenePalette.wood} roughness={0.7} />
            </mesh>
          ))}
          {[-0.02, 0, 0.022].map((offset, i) => (
            <mesh key={`fletch-${i}`} position={[offset, 0.34, offset * 0.4]} rotation={[0, 0, offset * 2]}>
              <coneGeometry args={[0.018, 0.05, 4]} />
              <meshStandardMaterial color={scenePalette.fletching} roughness={0.8} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
});
