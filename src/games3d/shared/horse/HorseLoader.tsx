import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import { Asset } from 'expo-asset';
import { forwardRef, Suspense, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';

import type { AnimationStateId } from '../animation/animationTypes';
import { applyClipCrossfade } from '../animation/useClipCrossfade';
import { ModelErrorBoundary } from '../assets/ModelErrorBoundary';
import { horseModelManifest, type ModelManifestEntry } from '../assets/modelManifest';
import { CharacterHead } from '../characters/CharacterHead';
import { CharacterHair } from '../characters/CharacterHair';
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

type GltfHorseProps = {
  entry: ModelManifestEntry;
  visualStateRef: React.MutableRefObject<HorseVisualState>;
  riderVariant: CharacterVariant;
  coatColor?: string;
};

/** A simple, generic seated rider for a GLB horse whose actual back width
 * isn't tuned/measured the way the procedural HorseModel's rider is (that
 * one hugs a known 0.26-radius barrel) - legs hang down and slightly
 * outward rather than wrapping a specific curvature, which stays visually
 * reasonable across different real horse body shapes without per-model
 * tuning (Section 10: "if perfect skeletal rider animation is not
 * possible yet, keep a visually acceptable seated pose"). Reuses
 * CharacterHead/CharacterHair for a real face, same as every other
 * character in the app. */
function GenericRider({ variant }: { variant: CharacterVariant }) {
  return (
    <group>
      <mesh castShadow>
        <capsuleGeometry args={[0.14, 0.34, 4, 8]} />
        <meshStandardMaterial color={variant.clothingPrimary} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.03, 0.034, 0.05, 8]} />
        <meshStandardMaterial color={variant.skinTone} roughness={0.85} />
      </mesh>
      <group position={[0, 0.4, 0]}>
        <CharacterHead variant={variant} expression="neutral" />
        <CharacterHair variant={variant} />
      </group>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[0.16 * side, -0.28, 0]} rotation={[0, 0, side * 0.35]} castShadow>
            <cylinderGeometry args={[0.04, 0.034, 0.36, 8]} />
            <meshStandardMaterial color={variant.clothingSecondary} roughness={0.85} />
          </mesh>
          <mesh position={[0.24 * side, -0.5, 0.04]} castShadow>
            <boxGeometry args={[0.055, 0.04, 0.08]} />
            <meshStandardMaterial color="#2B2019" roughness={0.8} />
          </mesh>
          <mesh position={[0.14 * side, 0.06, -0.1]} rotation={[-0.7, 0, side * 0.2]} castShadow>
            <cylinderGeometry args={[0.024, 0.02, 0.32, 8]} />
            <meshStandardMaterial color={variant.clothingPrimary} roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Recolors a cloned copy of the GLB's own materials so a second horse
 * instance (e.g. Kyz Kuumai's AI rival) doesn't render as a visual
 * duplicate of the player's (Section 9: "make them visually distinct...
 * do not duplicate exact visual if avoidable"). Clones both the scene
 * graph and its materials - never mutates the shared cached `useGLTF`
 * result, which every instance of this model shares. */
function useTintedScene(scene: THREE.Group, tint: string | undefined) {
  return useMemo(() => {
    if (!tint) return scene;
    // Plain Object3D.clone(true) does not correctly clone a SkinnedMesh's
    // skeleton bindings - the clone's bones would still point at the
    // original's bone objects, breaking (or cross-contaminating) either
    // instance's animation. SkeletonUtils.clone is the standard fix.
    const clone = SkeletonUtils.clone(scene) as THREE.Group;
    const tintColor = new THREE.Color(tint);
    clone.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const applyTint = (mat: THREE.Material) => {
        if (mat instanceof THREE.MeshStandardMaterial && /main/i.test(mat.name)) {
          const cloned = mat.clone();
          cloned.color = tintColor.clone();
          return cloned;
        }
        return mat;
      };
      obj.material = Array.isArray(obj.material) ? obj.material.map(applyTint) : applyTint(obj.material);
    });
    return clone;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, tint]);
}

/** The GLB-driven half of HorseLoader - see CharacterLoader.tsx for why
 * this is a separate component rather than a conditional hook call. */
const GltfHorse = forwardRef<THREE.Group, GltfHorseProps>(function GltfHorse(
  { entry, visualStateRef, riderVariant, coatColor },
  ref,
) {
  const assetUri = useMemo(() => Asset.fromModule(entry.source).uri, [entry.source]);
  const gltf = useGLTF(assetUri) as unknown as { scene: THREE.Group; animations: THREE.AnimationClip[] };
  const scene = useTintedScene(gltf.scene, coatColor);
  const meshRef = useRef<THREE.Group>(null);
  const { actions } = useAnimations(gltf.animations, meshRef);
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

  const scale = entry.scale ?? 1;
  const groundOffsetY = entry.groundOffsetY ?? 0;
  const riderPosition = useMemo((): [number, number, number] => {
    const a = entry.riderAnchor ?? { x: 0, y: 0, z: 0 };
    return [a.x * scale, a.y * scale + groundOffsetY, a.z * scale];
  }, [entry.riderAnchor, scale, groundOffsetY]);

  return (
    <group ref={ref}>
      <primitive ref={meshRef} object={scene} scale={scale} position={[0, groundOffsetY, 0]} />
      {entry.riderAnchor ? (
        <group position={riderPosition}>
          <GenericRider variant={riderVariant} />
        </group>
      ) : null}
    </group>
  );
});

/** Drop-in replacement for `HorseModel` with an identical ref contract (a
 * plain `THREE.Group`, driven imperatively by the parent scene's own
 * useFrame - see KyzKuumaiScene.tsx/KokBoruScene.tsx) so existing call
 * sites don't change when a real GLB is registered. Renders the
 * procedural `HorseModel` unchanged for any `modelId` with no manifest
 * entry, or if the GLB fails to load (`ModelErrorBoundary`). */
export const HorseLoader = forwardRef<THREE.Group, HorseLoaderProps>(function HorseLoader(
  { visualStateRef, riderVariant, coatColor, modelId },
  ref,
) {
  const entry = modelId ? horseModelManifest[modelId] : undefined;
  const procedural = <HorseModel ref={ref} visualStateRef={visualStateRef} riderVariant={riderVariant} coatColor={coatColor} />;

  if (!entry) return procedural;

  return (
    <ModelErrorBoundary fallback={procedural}>
      <Suspense fallback={null}>
        <GltfHorse ref={ref} entry={entry} visualStateRef={visualStateRef} riderVariant={riderVariant} coatColor={coatColor} />
      </Suspense>
    </ModelErrorBoundary>
  );
});
