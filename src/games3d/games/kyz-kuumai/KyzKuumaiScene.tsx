import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import * as THREE from 'three';

import { ChaseCamera, type ChaseCameraTarget } from '../../camera/ChaseCamera';
import { scenePalette } from '../../shared/scenePalette';
import { HorseModel, type HorseVisualState } from '../../shared/horse/HorseModel';
import type { HorseController } from '../../shared/horse/HorseController';
import { KyzKuumaiCourse } from './KyzKuumaiCourse';
import { computeAiHorseInput } from './KyzKuumaiAI';
import type { KyzKuumaiPhase } from './KyzKuumaiTypes';

type KyzKuumaiSceneProps = {
  phase: KyzKuumaiPhase;
  playerHorseRef: React.MutableRefObject<HorseController>;
  aiHorseRef: React.MutableRefObject<HorseController>;
  moveX: SharedValue<number>;
  moveZ: SharedValue<number>;
  sprintHeld: SharedValue<boolean>;
  onTick: (dt: number) => void;
};

export function KyzKuumaiScene({ phase, playerHorseRef, aiHorseRef, moveX, moveZ, sprintHeld, onTick }: KyzKuumaiSceneProps) {
  const playerGroupRef = useRef<THREE.Group>(null);
  const aiGroupRef = useRef<THREE.Group>(null);
  const playerVisualRef = useRef<HorseVisualState>({ speed: 0, maxSpeed: 1, state: 'IDLE' });
  const aiVisualRef = useRef<HorseVisualState>({ speed: 0, maxSpeed: 1, state: 'IDLE' });
  const chaseCameraTargetRef = useRef<ChaseCameraTarget>({ x: 0, z: 0, heading: 0, speed: 0, maxSpeed: 1 });

  useFrame((_state, delta) => {
    const clampedDelta = Math.min(delta, 1 / 20);

    if (phase === 'PLAYING') {
      const player = playerHorseRef.current;
      player.step({ moveX: moveX.value, moveZ: moveZ.value, sprintHeld: sprintHeld.value }, clampedDelta);

      const ai = aiHorseRef.current;
      const aiInput = computeAiHorseInput({ x: ai.x, z: ai.z });
      ai.step(aiInput, clampedDelta);

      onTick(clampedDelta);
    }

    const player = playerHorseRef.current;
    const ai = aiHorseRef.current;

    if (playerGroupRef.current) {
      playerGroupRef.current.position.set(player.x, 0, player.z);
      playerGroupRef.current.rotation.y = player.heading;
    }
    if (aiGroupRef.current) {
      aiGroupRef.current.position.set(ai.x, 0, ai.z);
      aiGroupRef.current.rotation.y = ai.heading;
    }

    playerVisualRef.current.speed = player.speed;
    playerVisualRef.current.maxSpeed = player.config.maxSprintSpeed;
    playerVisualRef.current.state = player.state;

    aiVisualRef.current.speed = ai.speed;
    aiVisualRef.current.maxSpeed = ai.config.maxSprintSpeed;
    aiVisualRef.current.state = ai.state;

    chaseCameraTargetRef.current.x = player.x;
    chaseCameraTargetRef.current.z = player.z;
    chaseCameraTargetRef.current.heading = player.heading;
    chaseCameraTargetRef.current.speed = player.speed;
    chaseCameraTargetRef.current.maxSpeed = player.config.maxSprintSpeed;
  });

  return (
    <>
      <ChaseCamera targetRef={chaseCameraTargetRef} />

      <KyzKuumaiCourse />

      <HorseModel ref={playerGroupRef} visualStateRef={playerVisualRef} riderColor={scenePalette.terracotta} />
      <HorseModel ref={aiGroupRef} visualStateRef={aiVisualRef} riderColor={scenePalette.gold} />
    </>
  );
}
