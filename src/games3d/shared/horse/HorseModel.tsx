import { useFrame } from '@react-three/fiber';
import { forwardRef, type MutableRefObject, useRef } from 'react';
import * as THREE from 'three';

import { scenePalette } from '../scenePalette';
import type { HorseMovementState } from './HorseController';

export type HorseVisualState = { speed: number; maxSpeed: number; state: HorseMovementState };

type HorseModelProps = {
  /** Updated by the parent scene's own useFrame (cheap ref mutation, no
   * React state) - this component reads it in its own useFrame to drive a
   * procedural gait bob, since there's no GLB/skeletal animation yet
   * (Section 12/13: placeholder geometry, but still animated). */
  visualStateRef: MutableRefObject<HorseVisualState>;
  riderColor?: string;
};

const GAIT_CYCLES_PER_SECOND: Record<HorseMovementState, number> = { IDLE: 0, WALK: 1.4, TROT: 2.4, GALLOP: 3.4 };
const BOB_HEIGHT: Record<HorseMovementState, number> = { IDLE: 0.01, WALK: 0.04, TROT: 0.07, GALLOP: 0.1 };

/** Placeholder stylized horse + rider (Section 11/12) built from
 * primitives - no GLB yet (docs/GAME_ASSETS.md). Legs/body bob with a
 * procedural gait cycle keyed off the shared HorseController's movement
 * state so it doesn't read as "an animated object moving on rails"
 * (Section "KYZ KUUMAI — HORSE SYSTEM"), even without real animation clips.
 * The root group's position/rotation.y is set by the parent scene from
 * HorseController.x/z/heading every frame. */
export const HorseModel = forwardRef<THREE.Group, HorseModelProps>(function HorseModel({ visualStateRef, riderColor = scenePalette.terracotta }, ref) {
  const bodyRef = useRef<THREE.Group>(null);
  const frontLegsRef = useRef<THREE.Group>(null);
  const backLegsRef = useRef<THREE.Group>(null);
  const phaseRef = useRef(0);

  useFrame((_state, delta) => {
    const { speed, maxSpeed, state } = visualStateRef.current;
    const cyclesPerSecond = GAIT_CYCLES_PER_SECOND[state];
    phaseRef.current += delta * cyclesPerSecond * Math.PI * 2;

    const bobAmount = BOB_HEIGHT[state];
    if (bodyRef.current) {
      bodyRef.current.position.y = 0.62 + Math.abs(Math.sin(phaseRef.current)) * bobAmount;
    }
    const legSwing = state === 'IDLE' ? 0 : Math.sin(phaseRef.current) * (0.35 + Math.min(1, speed / maxSpeed) * 0.35);
    if (frontLegsRef.current) frontLegsRef.current.rotation.x = legSwing;
    if (backLegsRef.current) backLegsRef.current.rotation.x = -legSwing;
  });

  return (
    <group ref={ref}>
      <group ref={bodyRef} position={[0, 0.62, 0]}>
        {/* Body */}
        <mesh castShadow>
          <boxGeometry args={[0.55, 0.5, 1.1]} />
          <meshStandardMaterial color={scenePalette.dirt} roughness={0.85} />
        </mesh>
        {/* Neck + head */}
        <mesh position={[0, 0.28, -0.65]} rotation={[0.5, 0, 0]} castShadow>
          <boxGeometry args={[0.28, 0.55, 0.28]} />
          <meshStandardMaterial color={scenePalette.dirt} roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.55, -0.9]} castShadow>
          <boxGeometry args={[0.22, 0.24, 0.4]} />
          <meshStandardMaterial color={scenePalette.wood} roughness={0.85} />
        </mesh>
        {/* Tail */}
        <mesh position={[0, 0.1, 0.62]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.08, 0.4, 0.08]} />
          <meshStandardMaterial color={scenePalette.wood} roughness={1} />
        </mesh>

        {/* Rider */}
        <group position={[0, 0.55, -0.05]}>
          <mesh castShadow>
            <capsuleGeometry args={[0.16, 0.4, 4, 8]} />
            <meshStandardMaterial color={riderColor} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.36, 0]} castShadow>
            <sphereGeometry args={[0.13, 10, 10]} />
            <meshStandardMaterial color="#E8C39E" roughness={0.9} />
          </mesh>
        </group>
      </group>

      {/* Legs (not bobbed with the body - swing independently for gait) */}
      <group ref={frontLegsRef} position={[0, 0.5, -0.35]}>
        <mesh position={[-0.18, -0.25, 0]}>
          <cylinderGeometry args={[0.06, 0.05, 0.5, 6]} />
          <meshStandardMaterial color={scenePalette.wood} roughness={0.9} />
        </mesh>
        <mesh position={[0.18, -0.25, 0]}>
          <cylinderGeometry args={[0.06, 0.05, 0.5, 6]} />
          <meshStandardMaterial color={scenePalette.wood} roughness={0.9} />
        </mesh>
      </group>
      <group ref={backLegsRef} position={[0, 0.5, 0.35]}>
        <mesh position={[-0.18, -0.25, 0]}>
          <cylinderGeometry args={[0.06, 0.05, 0.5, 6]} />
          <meshStandardMaterial color={scenePalette.wood} roughness={0.9} />
        </mesh>
        <mesh position={[0.18, -0.25, 0]}>
          <cylinderGeometry args={[0.06, 0.05, 0.5, 6]} />
          <meshStandardMaterial color={scenePalette.wood} roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
});
