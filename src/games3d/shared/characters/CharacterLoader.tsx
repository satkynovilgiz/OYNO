import { useAnimations, useGLTF } from '@react-three/drei';
import { Asset } from 'expo-asset';
import { forwardRef, Suspense, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';

import type { AnimationStateId } from '../animation/animationTypes';
import { useClipCrossfade } from '../animation/useClipCrossfade';
import { characterModelManifest, type ModelManifestEntry } from '../assets/modelManifest';
import { CharacterModel, type CharacterHandle } from './CharacterModel';
import type { CharacterExpression, CharacterVariant } from './CharacterTypes';

type CharacterLoaderProps = {
  variant: CharacterVariant;
  expression?: CharacterExpression;
  idleAnimation?: boolean;
  /** No-op for the procedural fallback (it has its own fixed idle bob +
   * per-game pose helpers) - only read once a GLB entry actually exists. */
  animationState?: AnimationStateId;
};

type GltfCharacterProps = {
  entry: ModelManifestEntry;
  animationState: AnimationStateId;
};

/** The GLB-driven half of CharacterLoader, split into its own component so
 * `useGLTF`/`useAnimations` are only ever called when an entry genuinely
 * exists - CharacterLoader itself stays hook-free and just picks which of
 * the two to render (conditionally rendering a different component is
 * fine; conditionally calling hooks inside one component is not). */
const GltfCharacter = forwardRef<CharacterHandle, GltfCharacterProps>(function GltfCharacter(
  { entry, animationState },
  ref,
) {
  // `entry.source` is a Metro asset module id (a `require(...)` result),
  // not a URL - `Asset.fromModule` is what turns it into the fetchable URI
  // `useGLTF`'s underlying THREE loader actually needs (Section: "resolves
  // through expo-asset", docs/GAME_ASSETS.md).
  const assetUri = useMemo(() => Asset.fromModule(entry.source).uri, [entry.source]);
  const gltf = useGLTF(assetUri) as unknown as { scene: THREE.Group; animations: THREE.AnimationClip[] };
  const rootRef = useRef<THREE.Group>(null);
  const { actions } = useAnimations(gltf.animations, rootRef);

  useClipCrossfade(actions, entry.clipNames, animationState);

  useImperativeHandle(ref, () => ({
    get root() {
      return rootRef.current;
    },
    get head() {
      return resolveBone(rootRef.current, entry.bones?.head);
    },
    get leftShoulder() {
      return resolveBone(rootRef.current, entry.bones?.leftShoulder);
    },
    get rightShoulder() {
      return resolveBone(rootRef.current, entry.bones?.rightShoulder);
    },
  }));

  return <primitive ref={rootRef} object={gltf.scene} />;
});

function resolveBone(root: THREE.Group | null, name: string | undefined): THREE.Group | null {
  if (!root || !name) return null;
  // A skeleton bone isn't literally a THREE.Group, but CharacterHandle only
  // ever needs Object3D-level position/rotation mutation (see
  // CharacterAnimator.ts) - this bridges a real GLTF bone into that same
  // handle shape rather than widening the shared type for one caller.
  return (root.getObjectByName(name) as unknown as THREE.Group) ?? null;
}

/** Drop-in replacement for `CharacterModel` with an identical ref/prop
 * contract, so existing call sites (e.g. JaaAtuuScene.tsx) don't change
 * when a real GLB is eventually registered. Renders the procedural
 * `CharacterModel` unchanged for any `variant.modelId` with no manifest
 * entry - which, today, is every variant (Section: "STATUS:
 * STYLIZED_PROTOTYPE" still applies until a licensed model is added). */
export const CharacterLoader = forwardRef<CharacterHandle, CharacterLoaderProps>(function CharacterLoader(
  { variant, expression, idleAnimation, animationState = 'Idle' },
  ref,
) {
  const entry = variant.modelId ? characterModelManifest[variant.modelId] : undefined;

  if (!entry) {
    return <CharacterModel ref={ref} variant={variant} expression={expression} idleAnimation={idleAnimation} />;
  }

  return (
    <Suspense fallback={null}>
      <GltfCharacter ref={ref} entry={entry} animationState={animationState} />
    </Suspense>
  );
});
