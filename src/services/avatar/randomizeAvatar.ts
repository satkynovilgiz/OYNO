import { AVATAR_CATALOG, applySelection } from './avatarCatalog';
import { AVATAR_CATEGORY_IDS, type AvatarCategoryId, type AvatarConfig } from './avatarConfig';
import { EYE_COLOR_SWATCHES, HAIR_COLOR_SWATCHES, SKIN_TONE_SWATCHES } from './avatarColors';

export type RandomizeOptions = {
  /** Categories the user has pinned and randomize must leave untouched
   * (no explicit UI for this in v1, but the function supports it so a
   * future "lock this" affordance needs no store/logic changes). */
  lockedCategories?: ReadonlySet<AvatarCategoryId>;
  /** Only items in this set are eligible - callers pass
   * avatarUnlocks.getUnlockedItemIds()'s result so randomize can never
   * land on something the player hasn't earned. */
  unlockedItemIds: ReadonlySet<string>;
  /** Injectable for deterministic tests; defaults to Math.random. */
  rng?: () => number;
};

function pick<T>(list: readonly T[], rng: () => number): T {
  return list[Math.floor(rng() * list.length)];
}

/**
 * Generates a valid random combination: every illustrated category not in
 * `lockedCategories` gets a random *unlocked* item (via applySelection,
 * so the one compatibility rule still applies), and all 3 color pickers
 * (always free, never locked) get a random swatch. Never produces an
 * invalid AvatarConfig - the result always passes isValidAvatarConfig.
 */
export function randomizeAvatar(current: AvatarConfig, options: RandomizeOptions): AvatarConfig {
  const { lockedCategories = new Set<AvatarCategoryId>(), unlockedItemIds, rng = Math.random } = options;

  let next = { ...current };
  for (const categoryId of AVATAR_CATEGORY_IDS) {
    if (lockedCategories.has(categoryId)) continue;
    const candidates = AVATAR_CATALOG[categoryId].filter((item) => unlockedItemIds.has(item.id));
    if (candidates.length === 0) continue; // defensive: every category always has >=1 free item in practice
    next = applySelection(next, categoryId, pick(candidates, rng).id);
  }

  next.skinTone = pick(SKIN_TONE_SWATCHES, rng).id;
  next.hairColor = pick(HAIR_COLOR_SWATCHES, rng).id;
  next.eyeColor = pick(EYE_COLOR_SWATCHES, rng).id;

  return next;
}
