import { useFrame } from '@react-three/fiber';
import { forwardRef, type MutableRefObject, useRef } from 'react';
import * as THREE from 'three';

import { CharacterHead } from '../characters/CharacterHead';
import { CharacterHair } from '../characters/CharacterHair';
import type { CharacterVariant } from '../characters/CharacterTypes';
import { scenePalette } from '../scenePalette';
import type { HorseMovementState } from './HorseController';

export type HorseVisualState = { speed: number; maxSpeed: number; state: HorseMovementState };

type HorseModelProps = {
  /** Updated by the parent scene's own useFrame (cheap ref mutation, no
   * React state) - this component reads it in its own useFrame to drive a
   * procedural gait bob, since there's no GLB/skeletal animation yet
   * (Section 12/13: placeholder geometry, but still animated). */
  visualStateRef: MutableRefObject<HorseVisualState>;
  riderVariant: CharacterVariant;
  coatColor?: string;
};

const GAIT_CYCLES_PER_SECOND: Record<HorseMovementState, number> = { IDLE: 0, WALK: 1.4, TROT: 2.4, GALLOP: 3.4 };
const BOB_HEIGHT: Record<HorseMovementState, number> = { IDLE: 0.01, WALK: 0.04, TROT: 0.07, GALLOP: 0.1 };
const MANE_TUFT_COUNT = 8;
const MANE_DARK = '#2B2019';

/** Stylized horse + rider (Section 11/12/13) built from primitives - no GLB
 * yet (docs/GAME_ASSETS.md). Rounder capsule-based body/neck (not a box),
 * a flowing mane, a saddle blanket + pad as an explicit attachment anchor,
 * bridle straps, and a rider with a REAL face (CharacterHead/CharacterHair)
 * plus a bent-knee seated leg pose and arms reaching to the reins - not a
 * floating bust with no legs. Legs/body bob with a procedural gait cycle
 * keyed off HorseController's movement state. The root group's
 * position/rotation.y is set by the parent scene from HorseController's
 * x/z/heading every frame. STATUS: STYLIZED_PROTOTYPE (Section 71). */
export const HorseModel = forwardRef<THREE.Group, HorseModelProps>(function HorseModel(
  { visualStateRef, riderVariant, coatColor = scenePalette.dirt },
  ref,
) {
  const bodyRef = useRef<THREE.Group>(null);
  const frontLegsRef = useRef<THREE.Group>(null);
  const backLegsRef = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Group>(null);
  const phaseRef = useRef(0);

  useFrame((_state, delta) => {
    const { speed, maxSpeed, state } = visualStateRef.current;
    const cyclesPerSecond = GAIT_CYCLES_PER_SECOND[state];
    phaseRef.current += delta * cyclesPerSecond * Math.PI * 2;

    const bobAmount = BOB_HEIGHT[state];
    if (bodyRef.current) {
      bodyRef.current.position.y = 0.68 + Math.abs(Math.sin(phaseRef.current)) * bobAmount;
    }
    const legSwing = state === 'IDLE' ? 0 : Math.sin(phaseRef.current) * (0.35 + Math.min(1, speed / maxSpeed) * 0.35);
    if (frontLegsRef.current) frontLegsRef.current.rotation.x = legSwing;
    if (backLegsRef.current) backLegsRef.current.rotation.x = -legSwing;
    if (tailRef.current) tailRef.current.rotation.x = 0.35 + Math.sin(phaseRef.current * 0.5) * 0.08;
  });

  return (
    <group ref={ref}>
      <group ref={bodyRef} position={[0, 0.68, 0]}>
        {/* Body - a capsule laid along Z (nose-to-tail), not X, so it
            actually spans the distance to the neck/tail meshes below
            instead of leaving them floating off a sideways-oriented barrel
            (Section 11: "avoid generic box horse" - and avoid a
            disconnected one). Rounder capsule reads as a torso, not a box. */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <capsuleGeometry args={[0.26, 0.7, 4, 10]} />
          <meshStandardMaterial color={coatColor} roughness={0.8} />
        </mesh>

        {/* Neck + head + snout + ears */}
        <mesh position={[0, 0.24, -0.62]} rotation={[1.15, 0, 0]} castShadow>
          <capsuleGeometry args={[0.15, 0.4, 4, 8]} />
          <meshStandardMaterial color={coatColor} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.5, -0.92]} rotation={[0, 0, 0]} castShadow>
          <capsuleGeometry args={[0.11, 0.22, 4, 8]} />
          <meshStandardMaterial color={coatColor} roughness={0.8} />
        </mesh>
        {/* Dark muzzle tip - a common real marking, not a mistake: gives
            the snout a defined end instead of just fading into the coat. */}
        <mesh position={[0, 0.44, -1.1]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.075, 0.16, 8]} />
          <meshStandardMaterial color={MANE_DARK} roughness={0.85} />
        </mesh>
        <mesh position={[0.06, 0.63, -0.86]} rotation={[0, 0, -0.3]}>
          <coneGeometry args={[0.03, 0.09, 6]} />
          <meshStandardMaterial color={coatColor} roughness={0.8} />
        </mesh>
        <mesh position={[-0.06, 0.63, -0.86]} rotation={[0, 0, 0.3]}>
          <coneGeometry args={[0.03, 0.09, 6]} />
          <meshStandardMaterial color={coatColor} roughness={0.8} />
        </mesh>

        {/* Mane - overlapping tapered fins following the neck's slope
            (rotation.x matches the neck capsule's own 1.15 rad tilt) and
            shrinking toward the head, instead of a row of identical flat
            boxes, so it reads as flowing hair rather than a picket fence. */}
        {Array.from({ length: MANE_TUFT_COUNT }).map((_, i) => {
          const t = i / (MANE_TUFT_COUNT - 1);
          const tuftScale = 1 - t * 0.45;
          return (
            <mesh
              key={i}
              position={[0, 0.46 + t * 0.14, -0.28 - t * 0.62]}
              rotation={[1.15 - t * 0.3, 0, 0]}
              scale={[1, tuftScale, tuftScale]}
              castShadow
            >
              <coneGeometry args={[0.035, 0.16, 6]} />
              <meshStandardMaterial color={MANE_DARK} roughness={0.9} />
            </mesh>
          );
        })}

        {/* Bridle - simple straps over the snout/head. */}
        <mesh position={[0, 0.47, -0.98]}>
          <torusGeometry args={[0.1, 0.008, 6, 12]} />
          <meshStandardMaterial color="#3D2B1F" roughness={0.7} />
        </mesh>

        {/* Tail - a thicker base cone plus a slimmer overlapping cone for
            volume, and a couple of thin trailing strands so the tip doesn't
            end in a bare point. */}
        <group ref={tailRef} position={[0, 0.15, 0.58]}>
          <mesh position={[0, -0.16, 0.04]}>
            <coneGeometry args={[0.08, 0.4, 8]} />
            <meshStandardMaterial color={MANE_DARK} roughness={0.95} />
          </mesh>
          <mesh position={[0.02, -0.32, 0.09]} rotation={[0.1, 0, 0.08]}>
            <coneGeometry args={[0.045, 0.3, 6]} />
            <meshStandardMaterial color={MANE_DARK} roughness={0.95} />
          </mesh>
          <mesh position={[-0.02, -0.34, 0.1]} rotation={[0.12, 0, -0.06]}>
            <coneGeometry args={[0.035, 0.26, 6]} />
            <meshStandardMaterial color={MANE_DARK} roughness={0.95} />
          </mesh>
        </group>

        {/* Saddle - a fabric blanket peeking out under the wood seat (the
            attachment anchor for the rider, Section 13), plus stirrup rings
            the rider's boots actually sit in rather than bare straps. */}
        <mesh position={[0, 0.245, -0.02]} castShadow>
          <boxGeometry args={[0.36, 0.03, 0.4]} />
          <meshStandardMaterial color={scenePalette.terracotta} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.27, -0.02]} castShadow>
          <boxGeometry args={[0.3, 0.06, 0.32]} />
          <meshStandardMaterial color={scenePalette.wood} roughness={0.75} />
        </mesh>
        <mesh position={[0.16, 0.2, -0.02]}>
          <boxGeometry args={[0.03, 0.16, 0.06]} />
          <meshStandardMaterial color="#3D2B1F" roughness={0.8} />
        </mesh>
        <mesh position={[-0.16, 0.2, -0.02]}>
          <boxGeometry args={[0.03, 0.16, 0.06]} />
          <meshStandardMaterial color="#3D2B1F" roughness={0.8} />
        </mesh>
        <mesh position={[0.16, 0.12, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.045, 0.008, 6, 12]} />
          <meshStandardMaterial color="#3D2B1F" roughness={0.6} metalness={0.2} />
        </mesh>
        <mesh position={[-0.16, 0.12, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.045, 0.008, 6, 12]} />
          <meshStandardMaterial color="#3D2B1F" roughness={0.6} metalness={0.2} />
        </mesh>

        {/* Rider - seated torso with a REAL face via the shared character
            head/hair (Section 39/46), now with a bent-knee riding pose
            wrapping the barrel (not a legless floating bust) and arms
            reaching forward to the reins instead of ending at the
            shoulders. */}
        <group position={[0, 0.56, -0.02]}>
          <mesh castShadow>
            <capsuleGeometry args={[0.15, 0.36, 4, 8]} />
            <meshStandardMaterial color={riderVariant.clothingPrimary} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.32, 0]}>
            <cylinderGeometry args={[0.032, 0.036, 0.05, 8]} />
            <meshStandardMaterial color={riderVariant.skinTone} roughness={0.85} />
          </mesh>
          <group position={[0, 0.42, 0]}>
            <CharacterHead variant={riderVariant} expression="neutral" />
            <CharacterHair variant={riderVariant} />
          </group>

          {/* Legs - thigh reaches out and over the barrel from the hip,
              knee drops the shin down the horse's flank to a boot that
              lands right at the stirrup ring above. */}
          {[-1, 1].map((side) => (
            <group key={side}>
              <mesh position={[0.215 * side, -0.31, 0]} rotation={[0, 0, side * 1.15]} castShadow>
                <cylinderGeometry args={[0.042, 0.036, 0.2, 8]} />
                <meshStandardMaterial color={riderVariant.clothingSecondary} roughness={0.85} />
              </mesh>
              <mesh position={[0.3 * side, -0.35, 0]} castShadow>
                <sphereGeometry args={[0.036, 8, 8]} />
                <meshStandardMaterial color={riderVariant.clothingSecondary} roughness={0.85} />
              </mesh>
              <mesh position={[0.32 * side, -0.4, 0.02]} rotation={[0, 0, side * 0.2]} castShadow>
                <cylinderGeometry args={[0.032, 0.028, 0.1, 8]} />
                <meshStandardMaterial color={riderVariant.clothingSecondary} roughness={0.85} />
              </mesh>
              <mesh position={[0.33 * side, -0.46, 0.03]} castShadow>
                <boxGeometry args={[0.06, 0.045, 0.09]} />
                <meshStandardMaterial color="#2B2019" roughness={0.8} />
              </mesh>
            </group>
          ))}

          {/* Arms - reach forward and down to a rein point near the
              horse's neck instead of stopping at the shoulder. */}
          {[-1, 1].map((side) => (
            <group key={side}>
              <mesh position={[0.16 * side, 0.05, -0.1]} rotation={[-0.9, 0, side * 0.15]} castShadow>
                <cylinderGeometry args={[0.026, 0.022, 0.22, 8]} />
                <meshStandardMaterial color={riderVariant.clothingPrimary} roughness={0.8} />
              </mesh>
              <mesh position={[0.11 * side, -0.06, -0.32]} rotation={[-1.15, 0, side * 0.1]} castShadow>
                <cylinderGeometry args={[0.022, 0.018, 0.22, 8]} />
                <meshStandardMaterial color={riderVariant.skinTone} roughness={0.85} />
              </mesh>
              <mesh position={[0.09 * side, -0.09, -0.44]} castShadow>
                <sphereGeometry args={[0.02, 8, 8]} />
                <meshStandardMaterial color={riderVariant.skinTone} roughness={0.85} />
              </mesh>
            </group>
          ))}
        </group>
      </group>

      {/* Legs (not bobbed with the body - swing independently for gait) */}
      <group ref={frontLegsRef} position={[0, 0.56, -0.35]}>
        <mesh position={[-0.18, -0.28, 0]}>
          <cylinderGeometry args={[0.06, 0.045, 0.56, 6]} />
          <meshStandardMaterial color={coatColor} roughness={0.9} />
        </mesh>
        <mesh position={[-0.18, -0.55, 0]}>
          <cylinderGeometry args={[0.04, 0.045, 0.04, 6]} />
          <meshStandardMaterial color="#2B2019" roughness={0.9} />
        </mesh>
        <mesh position={[0.18, -0.28, 0]}>
          <cylinderGeometry args={[0.06, 0.045, 0.56, 6]} />
          <meshStandardMaterial color={coatColor} roughness={0.9} />
        </mesh>
        <mesh position={[0.18, -0.55, 0]}>
          <cylinderGeometry args={[0.04, 0.045, 0.04, 6]} />
          <meshStandardMaterial color="#2B2019" roughness={0.9} />
        </mesh>
      </group>
      <group ref={backLegsRef} position={[0, 0.56, 0.35]}>
        <mesh position={[-0.18, -0.28, 0]}>
          <cylinderGeometry args={[0.06, 0.045, 0.56, 6]} />
          <meshStandardMaterial color={coatColor} roughness={0.9} />
        </mesh>
        <mesh position={[-0.18, -0.55, 0]}>
          <cylinderGeometry args={[0.04, 0.045, 0.04, 6]} />
          <meshStandardMaterial color="#2B2019" roughness={0.9} />
        </mesh>
        <mesh position={[0.18, -0.28, 0]}>
          <cylinderGeometry args={[0.06, 0.045, 0.56, 6]} />
          <meshStandardMaterial color={coatColor} roughness={0.9} />
        </mesh>
        <mesh position={[0.18, -0.55, 0]}>
          <cylinderGeometry args={[0.04, 0.045, 0.04, 6]} />
          <meshStandardMaterial color="#2B2019" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
});
