import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import * as THREE from 'three';

import { AIM_CAMERA_OFFSET, AimCamera } from '../../camera/AimCamera';
import { IntroCameraSweep } from '../../camera/IntroCameraSweep';
import { GAME_INTRO_DURATION_MS } from '../../ui/GameIntroCard';
import { ArcheryRange } from './ArcheryRange';
import type { PendingShot } from './JaaAtuuController';
import { ARCHER_POSITION, arrowPositionAt, arrowVelocityAt, getTargetCenter, resolveImpact } from './JaaAtuuBallistics';
import { ARROW_FORWARD, JaaAtuuArrow } from './JaaAtuuArrow';
import { JaaAtuuBow } from './JaaAtuuBow';
import { JaaAtuuTarget } from './JaaAtuuTarget';
import type { ArrowShot, JaaAtuuDifficultyConfig, JaaAtuuPhase } from './JaaAtuuTypes';

const GROUND_Y = 0;
const MAX_FLIGHT_SECONDS = 4;
const INTRO_START_OFFSET = new THREE.Vector3(5, 5.5, 9);

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
}: JaaAtuuSceneProps) {
  const arrowGroupRef = useRef<THREE.Group>(null);
  const bowStringRef = useRef<THREE.Group>(null);
  const flightElapsedRef = useRef(0);
  const resolvedRef = useRef(false);

  const targetCenter = useMemo(() => getTargetCenter(config), [config]);

  useFrame((_state, delta) => {
    // Live bow-draw feedback (Section 26) - mutated directly, never via
    // React state, so holding a shot doesn't re-render at 60fps.
    if (bowStringRef.current) {
      const pull = isDrawing.value
        ? THREE.MathUtils.clamp((Date.now() - drawStartedAtMs.value - minDrawMs) / (maxDrawMs - minDrawMs), 0, 1)
        : 0;
      bowStringRef.current.position.z = pull * 0.18;
    }

    if (phase !== 'PLAYING' || !pendingShot || !arrowGroupRef.current) return;

    if (flightElapsedRef.current === 0) resolvedRef.current = false;
    flightElapsedRef.current += delta;
    const t = flightElapsedRef.current;

    const position = arrowPositionAt(pendingShot, t, config);
    arrowGroupRef.current.position.copy(position);

    const velocity = arrowVelocityAt(pendingShot, t, config).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(ARROW_FORWARD, velocity);
    arrowGroupRef.current.quaternion.copy(quaternion);

    const crossedTargetPlane = position.z <= targetCenter.z;
    const hitGround = position.y <= GROUND_Y;
    const timedOut = t > MAX_FLIGHT_SECONDS;

    if (!resolvedRef.current && (crossedTargetPlane || hitGround || timedOut)) {
      resolvedRef.current = true;
      flightElapsedRef.current = 0;

      const impact = crossedTargetPlane ? resolveImpact(position, targetCenter) : { ring: null, score: 0, hitOffset: null };
      onResolveShot({ aimX: pendingShot.aimX, aimY: pendingShot.aimY, power: pendingShot.power, ...impact });
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
      ) : (
        <AimCamera aimX={aimX} aimY={aimY} anchor={ARCHER_POSITION} lookAt={targetCenter} bullseyeSignalMs={bullseyeSignalMs} />
      )}

      <ArcheryRange targetDistance={config.targetDistance} />

      <JaaAtuuTarget center={targetCenter} />
      <JaaAtuuBow ref={bowStringRef} />

      {showIdleArrow || phase === 'PLAYING' ? (
        <group ref={arrowGroupRef} position={phase === 'PLAYING' ? undefined : idlePosition}>
          <JaaAtuuArrow />
        </group>
      ) : null}
    </>
  );
}
