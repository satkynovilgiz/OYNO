import type { AnimationStateId } from '../animation/animationTypes';

export type CharacterBoneSlot = 'head' | 'leftShoulder' | 'rightShoulder';

export type ModelManifestEntry = {
  /** A Metro asset module id, i.e. the literal result of
   * `require('../../../../assets/models/<name>.glb')` - resolved to a
   * fetchable URI at load time via `expo-asset`'s `Asset.fromModule`, per
   * `docs/GAME_ASSETS.md`. Never a remote URL string entered by hand. */
  source: number;
  /** Maps this app's animation-state vocabulary (`AnimationStateId`) to the
   * GLB's own clip names - different rigs/exports won't share a naming
   * convention, so call sites ask for `'Walk'`/`'Gallop'`/etc. and this is
   * the only place that needs to know the file's actual clip is named
   * e.g. `"Armature|Walk_InPlace"`. */
  clipNames: Partial<Record<AnimationStateId, string>>;
  /** Maps the joints a game's own per-frame code poses directly today (see
   * `CharacterAnimator.ts` - shoulder rotation for a bow draw) to this
   * GLB's actual node/bone names, so `CharacterLoader` can still expose a
   * `CharacterHandle`-shaped ref without every call site knowing whether
   * it's driving a procedural group or a GLTF skeleton bone. */
  bones?: Partial<Record<CharacterBoneSlot, string>>;
  /** Required before an entry may be added at all, per the "Claude must
   * not download an unlicensed model and pass it off as production art"
   * rule (docs/GAME_ASSETS.md's Model Log table) - mirrored here, not just
   * in the doc, so the constraint travels with the code. */
  license: { source: string; license: string; author?: string };
};

/**
 * GLB/GLTF model registry for CharacterLoader/HorseLoader, keyed by an
 * arbitrary `modelId` string (`CharacterVariant.modelId`, or a horse
 * preset's own id once HorseModelProps grows the same field).
 *
 * **Deliberately empty.** No GLB files exist in this repo
 * (`assets/models/` is empty) and none may be added here without a
 * `source`/`license` entry recorded first - see docs/GAME_ASSETS.md.
 * CharacterLoader/HorseLoader fall back to the procedural
 * CharacterModel/HorseModel for any `modelId` (including `undefined`)
 * with no entry here. That fallback is every character in the app today,
 * not a rare edge case - do not "helpfully" add a placeholder entry
 * pointing at a downloaded model to make this look populated.
 */
export const characterModelManifest: Record<string, ModelManifestEntry> = {};

export const horseModelManifest: Record<string, ModelManifestEntry> = {};
