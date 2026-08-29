import { EYE_COLOR_SWATCHES, HAIR_COLOR_SWATCHES, SKIN_TONE_SWATCHES } from './avatarColors';
import {
  AVATAR_CATEGORY_IDS,
  sanitizeAvatarConfig as sanitizeAvatarConfigCore,
  type AvatarCategoryId,
  type AvatarConfig,
} from './avatarConfig';
import { DEFAULT_AVATAR_CONFIG } from './defaultAvatar';

export type AvatarItemUnlock = { type: 'free' } | { type: 'rule'; ruleId: string };

export type AvatarItem = {
  id: string;
  categoryId: AvatarCategoryId;
  /** True until real illustrated artwork exists for this item - see
   * ART_REQUIREMENTS.md-equivalent notes in the implementation plan.
   * Consumers (ItemCard, AvatarPreview) must render an honest "coming
   * soon" treatment for these, never a blank square pretending to be
   * finished art. */
  isPlaceholder: boolean;
  unlock: AvatarItemUnlock;
};

function items(categoryId: AvatarCategoryId, ids: string[], gatedIds: ReadonlySet<string> = new Set()): AvatarItem[] {
  return ids.map((id) => ({
    id,
    categoryId,
    isPlaceholder: true,
    unlock: gatedIds.has(id) ? { type: 'rule', ruleId: `${categoryId}:${id}` } : { type: 'free' },
  }));
}

/**
 * Spec-scale (§7-14) item counts, still all development-asset placeholders
 * (see isPlaceholder above and the implementation plan's "art
 * requirements" appendix). The 6 "core identity" categories (faceShape,
 * eyebrows, nose, mouth, body, eyes - plus the color pickers in
 * avatarColors.ts) are ALL free - never locked, per the hard product
 * requirement (spec §16). Exactly 5 items across the whole catalog are
 * gated - one specific item per lockable category (hair, clothing,
 * headwear, accessory, background), named explicitly below via
 * `gatedIds` rather than by array position, so the id actually gated
 * always matches avatarUnlocks.ts's rule ids exactly. Every lockable
 * category still keeps every *other* item free, so a zero-progress
 * account can always assemble a complete avatar.
 *
 * Traditional Kyrgyz headwear/clothing ids (ак калпак, тебетей, элечек,
 * шөкүлө, чапан, ...) are named per spec §11/§12 using only their
 * widely-known names - no historical/regional claims are attached
 * anywhere in this file or in copy shown to users.
 */
export const AVATAR_CATALOG: Record<AvatarCategoryId, AvatarItem[]> = {
  faceShape: items('faceShape', ['oval', 'round', 'square', 'long', 'softAngular', 'wide', 'heart']),
  eyebrows: items('eyebrows', ['straight', 'arched', 'soft', 'thick', 'angled', 'bushy']),
  nose: items('nose', ['default', 'narrow', 'wide', 'upturned', 'straight', 'rounded']),
  mouth: items('mouth', ['neutral', 'smile', 'bigSmile', 'soft', 'smirk', 'openSmile']),
  body: items('body', ['slim', 'average', 'athletic', 'broad', 'tall', 'compact']),
  eyes: items('eyes', [
    'round',
    'almond',
    'wide',
    'gentle',
    'upturned',
    'downturned',
    'hooded',
    'monolid',
    'deepSet',
    'sleepy',
    'bright',
    'narrow',
  ]),
  hair: items(
    'hair',
    [
      'hair_01',
      'hair_02',
      'hair_03',
      'hair_04',
      'hair_05',
      'hair_06',
      'hair_07',
      'hair_08',
      'hair_09',
      'hair_10',
      'hair_11',
      'hair_12',
      'hair_13',
      'hair_14',
      'hair_15',
      'hair_16',
      'hair_17',
      'hair_18',
      'hair_19',
      'hair_20',
      'braid_01',
      'braid_02',
      'bun_01',
      'ponytail_01',
    ],
    new Set(['hair_10']),
  ),
  headwear: items(
    'headwear',
    ['none', 'akKalpak', 'tebetei', 'elechek', 'shokulo', 'embroideredCap', 'beanie', 'cap'],
    new Set(['shokulo']),
  ),
  clothing: items(
    'clothing',
    [
      'hoodie',
      'tshirt',
      'sweater',
      'jacket',
      'shirt',
      'chapan',
      'embroideredVest',
      'traditionalDress',
      'traditionalShirt',
      'ethnoModernJacket',
    ],
    new Set(['chapan']),
  ),
  accessory: items(
    'accessory',
    ['none', 'glasses', 'sunglasses', 'earrings', 'necklace', 'ornamentalPin'],
    new Set(['ornamentalPin']),
  ),
  background: items(
    'background',
    [
      'beige',
      'alaTooMountains',
      'issykKul',
      'greenJailoo',
      'bozUyInterior',
      'shyrdakPattern',
      'darkGreen',
      'sunsetMountains',
    ],
    new Set(['shyrdakPattern']),
  ),
};

// "beige" is a plain color fill, not an illustration - real from day one,
// same as the color swatches.
AVATAR_CATALOG.background[0].isPlaceholder = false;
// "none" items (no headwear/accessory) need no art at all.
AVATAR_CATALOG.headwear[0].isPlaceholder = false;
AVATAR_CATALOG.accessory[0].isPlaceholder = false;

// Real illustrated art now exists for these (sliced from the reference
// mockups - see avatarArt.ts) - every other item stays a placeholder.
const ITEMS_WITH_REAL_ART: Record<string, ReadonlySet<string>> = {
  faceShape: new Set(['oval', 'round', 'square', 'long', 'softAngular', 'wide']),
  hair: new Set(['hair_01', 'hair_02', 'hair_03', 'hair_04', 'hair_05', 'hair_06']),
  eyebrows: new Set(['straight', 'arched', 'soft', 'thick', 'angled', 'bushy']),
  nose: new Set(['default', 'narrow', 'wide', 'upturned', 'straight', 'rounded']),
  mouth: new Set(['neutral', 'smile', 'bigSmile', 'soft', 'smirk', 'openSmile']),
};
for (const [categoryId, ids] of Object.entries(ITEMS_WITH_REAL_ART)) {
  for (const item of AVATAR_CATALOG[categoryId as AvatarCategoryId]) {
    if (ids.has(item.id)) item.isPlaceholder = false;
  }
}

/** Every id ever offered for a color-only field, for sanitizeAvatarConfig
 * below - these aren't AvatarItems (no illustration/unlock concept), just
 * valid ids. */
const COLOR_FIELD_IDS = {
  skinTone: new Set(SKIN_TONE_SWATCHES.map((s) => s.id)),
  hairColor: new Set(HAIR_COLOR_SWATCHES.map((s) => s.id)),
  eyeColor: new Set(EYE_COLOR_SWATCHES.map((s) => s.id)),
} as const;

function buildValidIdSets(): Record<AvatarCategoryId | 'skinTone' | 'hairColor' | 'eyeColor', ReadonlySet<string>> {
  const byCategory = Object.fromEntries(
    AVATAR_CATEGORY_IDS.map((categoryId) => [categoryId, new Set(AVATAR_CATALOG[categoryId].map((item) => item.id))]),
  ) as unknown as Record<AvatarCategoryId, ReadonlySet<string>>;
  return { ...byCategory, ...COLOR_FIELD_IDS };
}

const VALID_ID_SETS = buildValidIdSets();

/** Catalog-aware wrapper around avatarConfig.ts's structural sanitizer -
 * falls back to DEFAULT_AVATAR_CONFIG for any field whose saved id no
 * longer exists in the current catalog. */
export function sanitizeAvatarConfig(raw: Partial<AvatarConfig> | null | undefined): AvatarConfig {
  return sanitizeAvatarConfigCore(raw, VALID_ID_SETS, DEFAULT_AVATAR_CONFIG);
}

export function getStarterItemId(categoryId: AvatarCategoryId): string {
  const starter = AVATAR_CATALOG[categoryId].find((item) => item.unlock.type === 'free');
  // Every category is guaranteed at least one free item (enforced by
  // avatarCatalog.test.ts) - the fallback below only matters if that
  // invariant is ever violated, so it fails safe rather than crashing.
  return starter?.id ?? AVATAR_CATALOG[categoryId][0].id;
}

// --- Compatibility rules (MVP: one rule) ---------------------------------

/** Full head coverings - элечек (a wrapped headdress covering all hair)
 * and шөкүлө (a tall ceremonial headdress) - don't visually work with the
 * longest hairstyles once real art exists - selecting one resets the
 * other back to its starter style rather than allowing a broken-looking
 * combination. */
const FULL_COVERAGE_HEADWEAR_IDS = new Set(['elechek', 'shokulo']);
const LONG_HAIR_IDS = new Set(['braid_01', 'braid_02', 'bun_01', 'ponytail_01']);

export function isCompatible(config: AvatarConfig, categoryId: AvatarCategoryId, itemId: string): boolean {
  if (categoryId === 'headwear' && FULL_COVERAGE_HEADWEAR_IDS.has(itemId) && LONG_HAIR_IDS.has(config.hair)) {
    return false;
  }
  if (categoryId === 'hair' && LONG_HAIR_IDS.has(itemId) && FULL_COVERAGE_HEADWEAR_IDS.has(config.headwear)) {
    return false;
  }
  return true;
}

/** Applies a selection, auto-resolving the one known incompatibility by
 * resetting the conflicting field to its starter item rather than
 * rejecting the tap outright - matches spec's "no option creates broken
 * visual combinations" QA requirement without a dead-end UI. */
export function applySelection(config: AvatarConfig, categoryId: AvatarCategoryId, itemId: string): AvatarConfig {
  const next = { ...config } as unknown as Record<string, string>;
  next[categoryId] = itemId;
  if (categoryId === 'headwear' && FULL_COVERAGE_HEADWEAR_IDS.has(itemId) && LONG_HAIR_IDS.has(next.hair)) {
    next.hair = getStarterItemId('hair');
  }
  if (categoryId === 'hair' && LONG_HAIR_IDS.has(itemId) && FULL_COVERAGE_HEADWEAR_IDS.has(next.headwear)) {
    next.headwear = getStarterItemId('headwear');
  }
  return next as unknown as AvatarConfig;
}
