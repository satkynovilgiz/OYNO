import { useGLTF } from '@react-three/drei';
import { Asset } from 'expo-asset';

import { characterModelManifest, horseModelManifest } from './modelManifest';

/** Starts (and caches) a GLB fetch/parse ahead of when a Scene actually
 * mounts a `CharacterLoader`/`HorseLoader` GLB variant for it - call from
 * each GLB-using game's top-level `<Name>Game.tsx` on mount, before
 * gameplay starts (Section "Preload the humanoid and horse GLB assets
 * before gameplay starts").
 *
 * This is NOT a second/separate load: `useGLTF.preload(uri)` resolves to
 * `useLoader.preload(GLTFLoader, uri, ...)`, whose cache key is
 * `[GLTFLoader, uri]` - the loader *class* and the url string, not the
 * per-call extensions closure - and `CharacterLoader`/`HorseLoader`'s own
 * `useGLTF(assetUri)` calls resolve to the exact same key (same class,
 * same `Asset.fromModule(entry.source).uri`, no draco/meshopt overrides on
 * either side). One shared, global cache entry either way (Section "Reuse
 * cached models instead of unnecessarily loading them again") - calling
 * preload just starts filling it sooner than waiting for the Scene's own
 * Suspense boundary to trigger it, and calling it more than once (e.g. a
 * horse needed by both the player and AI instance) is a safe no-op once
 * cached.
 *
 * A `modelId` with no manifest entry is a silent no-op, matching
 * `CharacterLoader`/`HorseLoader`'s own "no entry -> stay procedural"
 * contract - this never forces a game that doesn't use a given model to
 * load it. */
export function preloadCharacterModel(modelId: string | undefined) {
  const entry = modelId ? characterModelManifest[modelId] : undefined;
  if (!entry) return;
  useGLTF.preload(Asset.fromModule(entry.source).uri);
}

export function preloadHorseModel(modelId: string | undefined) {
  const entry = modelId ? horseModelManifest[modelId] : undefined;
  if (!entry) return;
  useGLTF.preload(Asset.fromModule(entry.source).uri);
}
