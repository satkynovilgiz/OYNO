import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import * as THREE from 'three';

import { ChaseCamera, type ChaseCameraTarget } from '../../camera/ChaseCamera';
import type { HorseController } from '../../shared/horse/HorseController';
import { HorseModel, type HorseVisualState } from '../../shared/horse/HorseModel';
import { scenePalette } from '../../shared/scenePalette';
import { KokBoruArena } from './KokBoruArena';
import { KokBoruObject } from './KokBoruObject';
import type { KokBoruPhase, KokBoruPossession } from './KokBoruTypes';

/** Offset from the horse (in the horse's own facing frame) where a carried
 * object is held - tucked slightly forward/side of the rider. */
const CARRY_OFFSET = { x: 0.32, y: 0.75, z: -0.15 };

type KokBoruSceneProps = {
  phase: KokBoruPhase;
  possession: KokBoruPossession;
  playerHorseRef: React.MutableRefObject<HorseController>;
  objectPositionRef: React.MutableRefObject<{ x: number; z: number }>;
  moveX: SharedValue<number>;
  moveZ: SharedValue<number>;
  sprintHeld: SharedValue<boolean>;
  onTick: (dt: number) => void;
};

export function KokBoruScene({ phase, possession, playerHorseRef, objectPositionRef, moveX, moveZ, sprintHeld, onTick }: KokBoruSceneProps) {
  const horseGroupRef = useRef<THREE.Group>(null);
  const objectGroupRef = useRef<THREE.Group>(null);
  const visualStateRef = useRef<HorseVisualState>({ speed: 0, maxSpeed: 1, state: 'IDLE' });
  const chaseCameraTargetRef = useRef<ChaseCameraTarget>({ x: 0, z: 0, heading: 0, speed: 0, maxSpeed: 1 });

  useFrame((_state, delta) => {
    const clampedDelta = Math.min(delta, 1 / 20);
    const horse = playerHorseRef.current;

    if (phase === 'PLAYING') {
      horse.step({ moveX: moveX.value, moveZ: moveZ.value, sprintHeld: sprintHeld.value }, clampedDelta);
      onTick(clampedDelta);
    }

    if (horseGroupRef.current) {
      horseGroupRef.current.position.set(horse.x, 0, horse.z);
      horseGroupRef.current.rotation.y = horse.heading;
    }

    if (objectGroupRef.current) {
      if (possession === 'PLAYER') {
        const cos = Math.cos(horse.heading);
        const sin = Math.sin(horse.heading);
        objectGroupRef.current.position.set(
          horse.x + CARRY_OFFSET.x * cos + CARRY_OFFSET.z * sin,
          CARRY_OFFSET.y,
          horse.z - CARRY_OFFSET.x * sin + CARRY_OFFSET.z * cos,
        );
      } else {
        objectGroupRef.current.position.set(objectPositionRef.current.x, 0.2, objectPositionRef.current.z);
      }
    }

    visualStateRef.current.speed = horse.speed;
    visualStateRef.current.maxSpeed = horse.config.maxSprintSpeed;
    visualStateRef.current.state = horse.state;

    chaseCameraTargetRef.current.x = horse.x;
    chaseCameraTargetRef.current.z = horse.z;
    chaseCameraTargetRef.current.heading = horse.heading;
    chaseCameraTargetRef.current.speed = horse.speed;
    chaseCameraTargetRef.current.maxSpeed = horse.config.maxSprintSpeed;
  });

  return (
    <>
      {/* Slightly higher/farther back than Kyz Kuumai's chase cam (Section
          "KOK BORU — CAMERA": better situational awareness). */}
      <ChaseCamera targetRef={chaseCameraTargetRef} followDistance={5.2} followHeight={2.6} />

      <KokBoruArena />

      <HorseModel ref={horseGroupRef} visualStateRef={visualStateRef} riderColor={scenePalette.terracotta} />
      <KokBoruObject ref={objectGroupRef} />
    </>
  );
}
