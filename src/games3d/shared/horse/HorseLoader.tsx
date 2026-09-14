import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import { Asset } from 'expo-asset';
import { forwardRef, Suspense, useMemo, useRef } from 'react';
import * as THREE from 'three';

import type { AnimationStateId } from '../animation/animationTypes';
import { applyClipCrossfade } from '../animation/useClipCrossfade';
import { horseModelManifest, type ModelManifestEntry } from '../assets/modelManifest';
import type { CharacterVariant } from '../characters/CharacterTypes';
import { HorseModel, type HorseVisualState } from './HorseModel';
import type { HorseMovementState } from './HorseController';

type HorseLoaderProps = {
  visualStateRef: React.MutableRefObject<HorseVisualState>;
  riderVariant: CharacterVariant;
  coatColor?: string;
  /** Looks up a GLB entry in `shared/assets/modelManifest.ts`. Omitted (the
   * default for every call site today) means "use the procedural
   * HorseModel," matching CharacterLoader's `variant.modelId` contract. */
  modelId?: string;
};

const GAIT_TO_ANIMATION: Record<HorseMovementState, AnimationStateId> = {
  IDLE: 'Idle',
  WALK: 'Walk',
  // No dedicated "Trot" in the shared AnimationStateId vocabulary (Section
  // "Idle/Walk/Run/Gallop/Aim/Shoot/Ride") - Run is the closest available
  // clip for a horse's middle gait.
  TROT: 'Run',
  GALLOP: 'Gallop',
};

type GltfHorseProps = { entry: ModelManifestEntry; visualStateRef: React.MutableRefObject<HorseVisualState> };

/** The GLB-driven half of HorseLoader - see CharacterLoader.tsx for why
 * this is a separate component rather than a conditional hook call. */
const GltfHorse = forwardRef<THREE.Group, GltfHorseProps>(function GltfHorse({ entry, visualStateRef }, ref) {
  const assetUri = useMemo(() => Asset.fromModule(entry.source).uri, [entry.source]);
  const gltf = useGLTF(assetUri) as unknown as { scene: THREE.Group; animations: THREE.AnimationClip[] };
  const rootRef = useRef<THREE.Group>(null);
  const { actions } = useAnimations(gltf.animations, rootRef);
  const currentClipName = useRef<string | null>(null);

  // `visualStateRef` is mutated every physics tick without a re-render
  // (Section 86/87 - refs, not React state, for per-frame data), so the
  // gait can only be read from a `useFrame` poll, not at render time -
  // `applyClipCrossfade` itself is a no-op unless the resolved clip name
  // actually changed, so polling it unconditionally every frame is cheap.
  useFrame(() => {
    const desiredState = GAIT_TO_ANIMATION[visualStateRef.current.state];
    applyClipCrossfade(actions, entry.clipNames, desiredState, currentClipName);
  });

  return <primitive ref={rootRef} object={gltf.scene} />;
});

/** Drop-in replacement for `HorseModel` with an identical ref contract (a
 * plain `THREE.Group`, driven imperatively by the parent scene's own
 * useFrame - see KyzKuumaiScene.tsx/KokBoruScene.tsx) so existing call
 * sites don't change when a real GLB is eventually registered. Renders the
 * procedural `HorseModel` unchanged for any `modelId` with no manifest
 * entry - which, today, is every horse. */
export const HorseLoader = forwardRef<THREE.Group, HorseLoaderProps>(function HorseLoader(
  { visualStateRef, riderVariant, coatColor, modelId },
  ref,
) {
  const entry = modelId ? horseModelManifest[modelId] : undefined;

  if (!entry) {
    return <HorseModel ref={ref} visualStateRef={visualStateRef} riderVariant={riderVariant} coatColor={coatColor} />;
  }

  return (
    <Suspense fallback={null}>
      <GltfHorse ref={ref} entry={entry} visualStateRef={visualStateRef} />
    </Suspense>
  );
});
