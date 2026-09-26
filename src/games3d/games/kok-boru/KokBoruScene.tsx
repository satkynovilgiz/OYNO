import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import * as THREE from 'three';

import { ChaseCamera, type ChaseCameraTarget } from '../../camera/ChaseCamera';
import { clampFrameDelta } from '../../core/frameDelta';
import { CHARACTER_PRESETS } from '../../shared/characters/CharacterTypes';
import { publishStamina, type HorseController } from '../../shared/horse/HorseController';
import { HorseLoader } from '../../shared/horse/HorseLoader';
import type { HorseVisualState } from '../../shared/horse/HorseModel';
import { computeAiSteering } from './KokBoruAI';
import { KokBoruArena } from './KokBoruArena';
import { KokBoruObject } from './KokBoruObject';
import { AI_GOAL } from './KokBoruTypes';
import type { KokBoruPhase, KokBoruPossession } from './KokBoruTypes';

/** Offset from a horse (in its own facing frame) where a carried object is
 * held - tucked slightly forward/side of the rider. Same anchor for
 * whichever side is carrying (Section 9: "both player and AI can score"). */
const CARRY_OFFSET = { x: 0.32, y: 0.75, z: -0.15 };

type KokBoruSceneProps = {
  phase: KokBoruPhase;
  possession: KokBoruPossession;
  playerHorseRef: React.MutableRefObject<HorseController>;
  aiHorseRef: React.MutableRefObject<HorseController>;
  /** Practice is solo (Section "KOK BORU PRACTICE": "no AI opponent") - no
   * AI horse is stepped or rendered, same pattern as Kyz Kuumai's
   * `showAiHorse`. */
  showAiHorse: boolean;
  objectPositionRef: React.MutableRefObject<{ x: number; z: number }>;
  moveX: SharedValue<number>;
  moveZ: SharedValue<number>;
  sprintHeld: SharedValue<boolean>;
  stamina?: SharedValue<number>;
  sprintAvailable?: SharedValue<boolean>;
  onTick: (dt: number) => void;
};

function carryPosition(horse: HorseController, out: THREE.Vector3) {
  const cos = Math.cos(horse.heading);
  const sin = Math.sin(horse.heading);
  out.set(horse.x + CARRY_OFFSET.x * cos + CARRY_OFFSET.z * sin, CARRY_OFFSET.y, horse.z - CARRY_OFFSET.x * sin + CARRY_OFFSET.z * cos);
  return out;
}

export function KokBoruScene({
  phase,
  possession,
  playerHorseRef,
  aiHorseRef,
  showAiHorse,
  objectPositionRef,
  moveX,
  moveZ,
  sprintHeld,
  stamina,
  sprintAvailable,
  onTick,
}: KokBoruSceneProps) {
  const playerGroupRef = useRef<THREE.Group>(null);
  const aiGroupRef = useRef<THREE.Group>(null);
  const objectGroupRef = useRef<THREE.Group>(null);
  const playerVisualRef = useRef<HorseVisualState>({ speed: 0, maxSpeed: 1, state: 'IDLE' });
  const aiVisualRef = useRef<HorseVisualState>({ speed: 0, maxSpeed: 1, state: 'IDLE' });
  const chaseCameraTargetRef = useRef<ChaseCameraTarget>({ x: 0, z: 0, heading: 0, speed: 0, maxSpeed: 1 });
  const carryScratch = useRef(new THREE.Vector3());

  useFrame((_state, delta) => {
    const clampedDelta = clampFrameDelta(delta);
    const player = playerHorseRef.current;
    const ai = aiHorseRef.current;

    if (phase === 'PLAYING') {
      player.step({ moveX: moveX.value, moveZ: moveZ.value, sprintHeld: sprintHeld.value }, clampedDelta);
      publishStamina(player, stamina, sprintAvailable);

      if (showAiHorse) {
        // The AI's target follows the match state it's already being told
        // via `possession` (Section 6/7: "AI chases the player" / "AI
        // rides toward its goal") - no separate AI-only state needed here.
        const target =
          possession === 'FREE'
            ? objectPositionRef.current
            : possession === 'PLAYER'
              ? { x: player.x, z: player.z }
              : AI_GOAL;
        ai.step(computeAiSteering({ x: ai.x, z: ai.z }, target, true), clampedDelta);
      }

      onTick(clampedDelta);
    }

    if (playerGroupRef.current) {
      playerGroupRef.current.position.set(player.x, 0, player.z);
      playerGroupRef.current.rotation.y = player.heading;
    }
    if (showAiHorse && aiGroupRef.current) {
      aiGroupRef.current.position.set(ai.x, 0, ai.z);
      aiGroupRef.current.rotation.y = ai.heading;
    }

    if (objectGroupRef.current) {
      if (possession === 'PLAYER') {
        objectGroupRef.current.position.copy(carryPosition(player, carryScratch.current));
      } else if (possession === 'AI') {
        objectGroupRef.current.position.copy(carryPosition(ai, carryScratch.current));
      } else {
        objectGroupRef.current.position.set(objectPositionRef.current.x, 0.2, objectPositionRef.current.z);
      }
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
      {/* Slightly higher/farther back than Kyz Kuumai's chase cam (Section
          "KOK BORU — CAMERA": better situational awareness). */}
      <ChaseCamera targetRef={chaseCameraTargetRef} followDistance={5.2} followHeight={2.6} />

      <KokBoruArena />

      <HorseLoader ref={playerGroupRef} visualStateRef={playerVisualRef} riderVariant={CHARACTER_PRESETS.kokBoruPlayer} modelId="quaterniusHorse" />
      {showAiHorse ? (
        <HorseLoader
          ref={aiGroupRef}
          visualStateRef={aiVisualRef}
          riderVariant={CHARACTER_PRESETS.kokBoruRival}
          coatColor="#2B2019"
          modelId="quaterniusHorse"
        />
      ) : null}
      <KokBoruObject ref={objectGroupRef} />
    </>
  );
}
