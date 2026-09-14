import { useAnimations, useGLTF } from '@react-three/drei';
import { Asset } from 'expo-asset';
import { forwardRef, Suspense, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';

import type { AnimationStateId } from '../animation/animationTypes';
import { useClipCrossfade } from '../animation/useClipCrossfade';
import { ModelErrorBoundary } from '../assets/ModelErrorBoundary';
import { characterModelManifest, type ModelManifestEntry } from '../assets/modelManifest';
import { scenePalette } from '../scenePalette';
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

/** Builds a small accessory (kalpak or quiver) sized for this specific
 * GLB's own bone-local scale - the armature's baked-in export scale (see
 * modelManifest.ts's `scale` doc comment) means a bone-attached child must
 * be authored at a tiny fraction of "real" size, not the same numbers the
 * procedural CharacterModel uses in already-normalized scene units. Takes
 * the bone's total ancestor scale so the accessory reads as the same
 * real-world size regardless of which GLB it's attached to. */
function buildAccessory(kind: 'kalpak' | 'quiver', boneWorldScale: number): THREE.Group {
  const group = new THREE.Group();
  const u = (worldSize: number) => worldSize / boneWorldScale;

  if (kind === 'kalpak') {
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(u(0.115), u(0.125), u(0.05), 16),
      new THREE.MeshStandardMaterial({ color: '#2B2019', roughness: 0.95 }),
    );
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(u(0.11), u(0.12), 16),
      new THREE.MeshStandardMaterial({ color: '#F3E5C9', roughness: 0.9 }),
    );
    top.position.y = u(0.085);
    group.add(brim, top);
    group.position.y = u(0.02);
  } else {
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(u(0.045), u(0.055), u(0.42), 8),
      new THREE.MeshStandardMaterial({ color: scenePalette.wood, roughness: 0.85 }),
    );
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(u(0.02), u(0.06), 6),
      new THREE.MeshStandardMaterial({ color: scenePalette.fletching, roughness: 0.85 }),
    );
    tip.position.y = u(0.24);
    group.add(tube, tip);
    group.rotation.set(0.25, 0, 0.15);
  }
  return group;
}

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

  // Cultural-identity accessories (Section: never claim the base mesh
  // itself is Kyrgyz) - attached directly to the resolved bones so they
  // follow any future animation instead of a fixed world-space offset.
  useEffect(() => {
    if (!entry.accessories) return;
    const headBone = resolveBone(rootRef.current, entry.bones?.head);
    const backBone = resolveBone(rootRef.current, entry.bones?.leftShoulder);
    const added: THREE.Object3D[] = [];

    if (entry.accessories.kalpak && headBone) {
      const worldScale = new THREE.Vector3();
      headBone.getWorldScale(worldScale);
      const kalpak = buildAccessory('kalpak', worldScale.y);
      kalpak.position.y = 0.02 / worldScale.y;
      headBone.add(kalpak);
      added.push(kalpak);
    }
    if (entry.accessories.quiver && backBone) {
      // No dedicated spine/back bone slot exists on CharacterHandle (it
      // only exposes head/shoulders) - the left shoulder bone is reused as
      // a reasonable anchor for a quiver strap crossing the back, both for
      // sizing (its own baked ancestor scale) and position (offset down
      // and behind the shoulder joint, in that same bone-local space).
      const worldScale = new THREE.Vector3();
      backBone.getWorldScale(worldScale);
      const quiver = buildAccessory('quiver', worldScale.y);
      quiver.position.set(-0.02 / worldScale.y, -0.15 / worldScale.y, -0.1 / worldScale.y);
      backBone.add(quiver);
      added.push(quiver);
    }

    return () => {
      added.forEach((obj) => obj.parent?.remove(obj));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf.scene]);

  return <primitive ref={rootRef} object={gltf.scene} scale={entry.scale ?? 1} position={[0, entry.groundOffsetY ?? 0, 0]} />;
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
 * when a real GLB is registered. Renders the procedural `CharacterModel`
 * unchanged for any `variant.modelId` with no manifest entry, or if the
 * GLB fails to load (`ModelErrorBoundary`) - both fall back the same way. */
export const CharacterLoader = forwardRef<CharacterHandle, CharacterLoaderProps>(function CharacterLoader(
  { variant, expression, idleAnimation, animationState = 'Idle' },
  ref,
) {
  const entry = variant.modelId ? characterModelManifest[variant.modelId] : undefined;
  const procedural = <CharacterModel ref={ref} variant={variant} expression={expression} idleAnimation={idleAnimation} />;

  if (!entry) return procedural;

  return (
    <ModelErrorBoundary fallback={procedural}>
      <Suspense fallback={null}>
        <GltfCharacter ref={ref} entry={entry} animationState={animationState} />
      </Suspense>
    </ModelErrorBoundary>
  );
});
