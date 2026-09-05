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
const MANE_TUFT_COUNT = 6;

/** Stylized horse + rider (Section 11/12/13) built from primitives - no GLB
 * yet (docs/GAME_ASSETS.md). Rounder capsule-based body/neck (not a box),
 * a mane, a saddle pad as an explicit attachment anchor, simple bridle
 * straps, and a rider with a REAL face (CharacterHead/CharacterHair) rather
 * than a bare sphere - full body/clothing/leg articulation for a seated
 * rider is deferred to each horse game's own polish pass (Section 13 notes
 * this is architecture-ready, not pretending to be finished). Legs/body
 * bob with a procedural gait cycle keyed off HorseController's movement
 * state. The root group's position/rotation.y is set by the parent scene
 * from HorseController.x/z/heading every frame. STATUS: STYLIZED_PROTOTYPE
 * (Section 71). */
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
        {/* Body - a horizontal capsule reads as a rounded animal torso,
            not a box (Section 11: "avoid generic box horse"). */}
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
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
        <mesh position={[0, 0.44, -1.1]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.075, 0.16, 8]} />
          <meshStandardMaterial color={scenePalette.wood} roughness={0.85} />
        </mesh>
        <mesh position={[0.06, 0.63, -0.86]} rotation={[0, 0, -0.3]}>
          <coneGeometry args={[0.03, 0.09, 6]} />
          <meshStandardMaterial color={coatColor} roughness={0.8} />
        </mesh>
        <mesh position={[-0.06, 0.63, -0.86]} rotation={[0, 0, 0.3]}>
          <coneGeometry args={[0.03, 0.09, 6]} />
          <meshStandardMaterial color={coatColor} roughness={0.8} />
        </mesh>

        {/* Mane - a row of small tufts along the top of the neck. */}
        {Array.from({ length: MANE_TUFT_COUNT }).map((_, i) => (
          <mesh key={i} position={[0, 0.42 + i * 0.01, -0.32 - i * 0.11]} rotation={[0.2, 0, 0]}>
            <boxGeometry args={[0.05, 0.1, 0.06]} />
            <meshStandardMaterial color={scenePalette.wood} roughness={0.9} />
          </mesh>
        ))}

        {/* Bridle - simple straps over the snout/head. */}
        <mesh position={[0, 0.47, -0.98]}>
          <torusGeometry args={[0.1, 0.008, 6, 12]} />
          <meshStandardMaterial color="#3D2B1F" roughness={0.7} />
        </mesh>

        {/* Tail */}
        <group ref={tailRef} position={[0, 0.15, 0.58]}>
          <mesh position={[0, -0.18, 0.05]}>
            <coneGeometry args={[0.07, 0.42, 8]} />
            <meshStandardMaterial color={scenePalette.wood} roughness={0.95} />
          </mesh>
        </group>

        {/* Saddle - the explicit attachment anchor for the rider (Section
            13: "Create saddle anchor"). */}
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

        {/* Rider - simplified seated torso (full leg articulation for a
            mounted pose is deferred to each horse game's polish pass), but
            a REAL face via the shared character head/hair, not a bare
            sphere (Section 39/46). */}
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
