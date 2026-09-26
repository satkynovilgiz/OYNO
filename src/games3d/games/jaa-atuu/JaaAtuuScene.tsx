import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import * as THREE from 'three';

import { AIM_CAMERA_OFFSET, AimCamera } from '../../camera/AimCamera';
import { IntroCameraSweep } from '../../camera/IntroCameraSweep';
import { clampFrameDelta } from '../../core/frameDelta';
import { applyDrawPose } from '../../shared/characters/CharacterAnimator';
import { CharacterLoader } from '../../shared/characters/CharacterLoader';
import type { CharacterHandle } from '../../shared/characters/CharacterModel';
import { CHARACTER_PRESETS } from '../../shared/characters/CharacterTypes';
import { GAME_INTRO_DURATION_MS } from '../../ui/GameIntroCard';
import { ArcheryRange } from './ArcheryRange';
import type { PendingShot } from './JaaAtuuController';
import { ARCHER_POSITION, arrowPositionAt, arrowVelocityAt, getTargetCenter, resolveFlight } from './JaaAtuuBallistics';
import { ARROW_FORWARD, JaaAtuuArrow } from './JaaAtuuArrow';
import { BOW_STRING_TIP_Y, BOW_STRING_TIP_Z, JaaAtuuBow, type JaaAtuuBowHandle } from './JaaAtuuBow';
import { JaaAtuuTarget } from './JaaAtuuTarget';
import type { ArrowShot, JaaAtuuDifficultyConfig, JaaAtuuPhase } from './JaaAtuuTypes';

const INTRO_START_OFFSET = new THREE.Vector3(5, 5.5, 9);
/** A short dolly out from the gameplay aim-camera position to a wider 3/4
 * hero angle when a round ends (Section: "camera cinematics" benchmark
 * item) - distinct from AimCamera's own gameplay framing and its separate
 * bullseye zoom (which stays as-is; this only plays once, at RESULT). */
const RESULT_HERO_OFFSET = new THREE.Vector3(3.2, 2.6, 4.2);
const RESULT_CAMERA_DURATION_MS = 1400;
/** The archer character faces +Z locally (CharacterHead's face features are
 * built at positive Z) but the target is at negative Z from the archer, so
 * the whole character is turned to face it. */
const ARCHER_FACING = Math.PI;

const STRING_UP = new THREE.Vector3(0, 1, 0);
const stringDirection = new THREE.Vector3();
const stringMidpoint = new THREE.Vector3();
const stringQuaternion = new THREE.Quaternion();
const topTip = new THREE.Vector3(0, BOW_STRING_TIP_Y, BOW_STRING_TIP_Z);
const bottomTip = new THREE.Vector3(0, -BOW_STRING_TIP_Y, BOW_STRING_TIP_Z);
const nockPoint = new THREE.Vector3();
// Per-frame scratch objects for the flying arrow (no allocation per frame).
const flightPosition = new THREE.Vector3();
const flightVelocity = new THREE.Vector3();
const flightQuaternion = new THREE.Quaternion();

/** Re-poses a unit-height string-segment cylinder to run from a fixed limb
 * tip to the shared moving nock point, instead of letting the whole string
 * translate as one rigid unit (which would visually detach it from the
 * limb tips while drawing - see JaaAtuuBow.tsx). */
function poseStringSegment(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3) {
  stringDirection.subVectors(to, from);
  const length = stringDirection.length();
  stringMidpoint.addVectors(from, to).multiplyScalar(0.5);
  mesh.position.copy(stringMidpoint);
  mesh.scale.set(1, length, 1);
  if (length > 1e-5) {
    stringQuaternion.setFromUnitVectors(STRING_UP, stringDirection.normalize());
    mesh.quaternion.copy(stringQuaternion);
  }
}

type JaaAtuuSceneProps = {
  phase: JaaAtuuPhase;
  config: JaaAtuuDifficultyConfig;
  pendingShot: PendingShot | null;
  onResolveShot: (shot: ArrowShot) => void;
  aimX: SharedValue<number>;
  aimY: SharedValue<number>;
  isDrawing: SharedValue<boolean>;
  drawStartedAtMs: SharedValue<number>;
  minDrawMs: number;
  maxDrawMs: number;
  bullseyeSignalMs?: number;
  /** This round's resolved shots - hits stay visible on the target face at
   * their exact scored position, so the player sees *where* each arrow
   * landed, not only the "+25" popup. Cleared on restart. */
  shots: ArrowShot[];
};

export function JaaAtuuScene({
  phase,
  config,
  pendingShot,
  onResolveShot,
  aimX,
  aimY,
  isDrawing,
  drawStartedAtMs,
  minDrawMs,
  maxDrawMs,
  bullseyeSignalMs,
  shots,
}: JaaAtuuSceneProps) {
  const arrowGroupRef = useRef<THREE.Group>(null);
  const bowRef = useRef<JaaAtuuBowHandle>(null);
  const archerRef = useRef<CharacterHandle>(null);
  const flightElapsedRef = useRef(0);
  const resolvedRef = useRef(false);

  const targetCenter = useMemo(() => getTargetCenter(config), [config]);
  // Solved once per shot: exact end time/point and the score it earns.
  const flight = useMemo(() => (pendingShot ? resolveFlight(pendingShot, config) : null), [pendingShot, config]);

  // A new shot (or a restart that clears one mid-flight) always starts the
  // flight clock from zero - a restart after pausing mid-flight used to
  // leave the old elapsed time behind for the next arrow.
  useEffect(() => {
    flightElapsedRef.current = 0;
    resolvedRef.current = false;
  }, [pendingShot]);

  useFrame((_state, delta) => {
    // Live bow-draw feedback (Section 26) - mutated directly, never via
    // React state, so holding a shot doesn't re-render at 60fps. The same
    // `pull` value also poses the archer's arms so the bow and body read
    // as one connected action, not a floating bow.
    const pull = isDrawing.value
      ? THREE.MathUtils.clamp((Date.now() - drawStartedAtMs.value - minDrawMs) / (maxDrawMs - minDrawMs), 0, 1)
      : 0;
    const bow = bowRef.current;
    if (bow?.topString && bow?.bottomString) {
      nockPoint.set(0, 0, BOW_STRING_TIP_Z + pull * 0.18);
      poseStringSegment(bow.topString, topTip, nockPoint);
      poseStringSegment(bow.bottomString, bottomTip, nockPoint);
    }

    const archer = archerRef.current;
    if (archer?.rightShoulder) applyDrawPose(archer.rightShoulder, pull, true);
    if (archer?.leftShoulder) applyDrawPose(archer.leftShoulder, pull, false);

    if (phase !== 'PLAYING' || !pendingShot || !flight || !arrowGroupRef.current || resolvedRef.current) return;

    flightElapsedRef.current = Math.min(flightElapsedRef.current + clampFrameDelta(delta), flight.endTime);
    const t = flightElapsedRef.current;

    arrowGroupRef.current.position.copy(arrowPositionAt(pendingShot, t, config, flightPosition));
    const velocity = arrowVelocityAt(pendingShot, t, config, flightVelocity).normalize();
    arrowGroupRef.current.quaternion.copy(flightQuaternion.setFromUnitVectors(ARROW_FORWARD, velocity));

    if (t >= flight.endTime) {
      // Lands exactly on the solved point - the same point that is scored.
      resolvedRef.current = true;
      onResolveShot({ aimX: pendingShot.aimX, aimY: pendingShot.aimY, power: pendingShot.power, ...flight.impact });
    }
  });

  const showIdleArrow = phase !== 'PLAYING';
  const idlePosition: [number, number, number] = [ARCHER_POSITION.x, ARCHER_POSITION.y, ARCHER_POSITION.z];

  return (
    <>
      {phase === 'INTRO' ? (
        <IntroCameraSweep
          positionAnchor={ARCHER_POSITION}
          startOffset={INTRO_START_OFFSET}
          endOffset={AIM_CAMERA_OFFSET}
          lookAt={targetCenter}
          durationMs={GAME_INTRO_DURATION_MS}
        />
      ) : phase === 'RESULT' ? (
        <IntroCameraSweep
          positionAnchor={ARCHER_POSITION}
          startOffset={AIM_CAMERA_OFFSET}
          endOffset={RESULT_HERO_OFFSET}
          lookAt={targetCenter}
          durationMs={RESULT_CAMERA_DURATION_MS}
        />
      ) : (
        <AimCamera aimX={aimX} aimY={aimY} anchor={ARCHER_POSITION} lookAt={targetCenter} bullseyeSignalMs={bullseyeSignalMs} />
      )}

      <ArcheryRange targetDistance={config.targetDistance} />

      <JaaAtuuTarget center={targetCenter} hits={shots} />

      <group position={[ARCHER_POSITION.x, 0, ARCHER_POSITION.z]} rotation={[0, ARCHER_FACING, 0]}>
        <CharacterLoader ref={archerRef} variant={CHARACTER_PRESETS.playerArcher} />
      </group>
      <JaaAtuuBow ref={bowRef} />

      {showIdleArrow || phase === 'PLAYING' ? (
        <group ref={arrowGroupRef} position={phase === 'PLAYING' ? undefined : idlePosition}>
          <JaaAtuuArrow />
        </group>
      ) : null}
    </>
  );
}
