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
  /** Uniform scale applied to the loaded scene so it matches this app's
   * "1 unit ~= 1 meter" world scale (WORLD_SCALE, scenePalette.ts) -
   * measured per-model from its own bone hierarchy, since exported rigs
   * rarely land on 1:1 by default (FBX2glTF commonly bakes in an
   * unrelated compensating scale on the armature root). Omit for 1:1. */
  scale?: number;
  /** Shifts the whole scaled model down (negative) or up so its feet/base
   * sit at local y=0, measured the same way as `scale`. Omit for none. */
  groundOffsetY?: number;
  /** Horse entries only - where a rider should be anchored, in the GLB's
   * own local space *before* `scale`/`groundOffsetY` are applied (the
   * loader applies those to this point too), measured from the model's
   * own back/spine bones. */
  riderAnchor?: { x: number; y: number; z: number };
  /** Procedural accessories to attach at runtime for cultural identity
   * (Section: "adapt only through clothing/props, not the base face") -
   * only meaningful for character entries with matching resolved bones. */
  accessories?: { kalpak?: boolean; quiver?: boolean };
  /** Required before an entry may be added at all, per the "Claude must
   * not download an unlicensed model and pass it off as production art"
   * rule (docs/GAME_ASSETS.md's Model Log table) - mirrored here, not just
   * in the doc, so the constraint travels with the code. */
  license: { source: string; license: string; author?: string };
};

/**
 * GLB/GLTF model registry for CharacterLoader/HorseLoader, keyed by an
 * arbitrary `modelId` string (`CharacterVariant.modelId`, or `HorseLoader`'s
 * own `modelId` prop).
 *
 * Every entry here must be CC0/public-domain or otherwise clearly licensed
 * for commercial use, per the "no unlicensed models" rule - see
 * docs/GAME_ASSETS.md's Model Log for full source/license/attribution
 * records. CharacterLoader/HorseLoader fall back to the procedural
 * CharacterModel/HorseModel for any `modelId` (including `undefined`) with
 * no entry here, or if the GLB fails to load - that fallback path is not a
 * rare edge case, do not remove it when adding entries.
 */
export const characterModelManifest: Record<string, ModelManifestEntry> = {
  // "Animated Human" by Quaternius, CC0 1.0 (public domain), no
  // attribution required - see docs/GAME_ASSETS.md for the full record.
  // Untextured (single flat-gray PBR material, no baseColorTexture) - a
  // generic mannequin by design, so cultural identity is added entirely
  // via the `accessories` below (kalpak, quiver), never the mesh itself.
  quaterniusHuman: {
    source: require('../../../../assets/models/quaternius-animated-human.glb'),
    scale: 0.34,
    groundOffsetY: -0.067,
    clipNames: {
      Idle: 'Human Armature|Idle',
      Walk: 'Human Armature|Walk',
      Run: 'Human Armature|Run',
      // No Aim/Shoot/Ride clips exist in this asset - JaaAtuuScene's
      // existing CharacterAnimator pose helpers (applyDrawPose) still work
      // by rotating the resolved LeftShoulder/RightShoulder bones
      // directly, same as they do for the procedural model, so aiming/
      // shooting still reads correctly without a dedicated clip.
    },
    bones: { head: 'Head', leftShoulder: 'LeftShoulder', rightShoulder: 'RightShoulder' },
    accessories: { kalpak: true, quiver: true },
    license: {
      source: 'https://poly.pizza/m/c3Ibh9I3udk (Quaternius, mirrored from quaternius.com)',
      license: 'CC0 1.0 Universal (Public Domain) - no attribution required',
      author: 'Quaternius',
    },
  },
};

export const horseModelManifest: Record<string, ModelManifestEntry> = {
  // "Horse" by Quaternius, CC0 1.0 - see docs/GAME_ASSETS.md.
  quaterniusHorse: {
    source: require('../../../../assets/models/quaternius-horse.glb'),
    scale: 0.51,
    groundOffsetY: -0.201,
    riderAnchor: { x: 0, y: 2.746, z: 0.092 },
    clipNames: {
      Idle: 'Idle',
      Walk: 'Walk',
      // No dedicated trot clip in this asset - HorseLoader's TROT->'Run'
      // mapping and this entry's Run->'Gallop' combine to mean trot and
      // gallop currently play the same animation. Reporting this plainly
      // rather than inventing a trot.
      Run: 'Gallop',
      Gallop: 'Gallop',
    },
    license: {
      source: 'https://poly.pizza/m/qvTrSG9pZF (Quaternius, mirrored from quaternius.com)',
      license: 'CC0 1.0 Universal (Public Domain) - no attribution required',
      author: 'Quaternius',
    },
  },
};
