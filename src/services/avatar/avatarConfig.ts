/**
 * The player's own customizable avatar (distinct from the story-character
 * system in src/components/character/ - see that module's own comments).
 * Kept as plain string-literal-union ids, not enums, matching this
 * codebase's existing convention (CharacterId, CharacterEmotion in
 * characterAssets.ts).
 */

/** The base illustrated portrait (spec section 1's "gender / base
 * character") - purely which bust illustration renders in the preview,
 * not a restriction on any other category: every hairstyle/clothing/
 * headwear item remains selectable regardless of base (spec section 10's
 * "do not lock by gender" principle applied consistently here too). */
export type BaseId = 'male' | 'female';
export type SkinToneId = 'skin_01' | 'skin_02' | 'skin_03' | 'skin_04' | 'skin_05' | 'skin_06';
export type FaceShapeId = 'oval' | 'round' | 'square' | 'long' | 'softAngular' | 'wide' | 'heart';
export type BodyId = 'slim' | 'average' | 'athletic' | 'broad' | 'tall' | 'compact';
export type EyeShapeId =
  | 'round'
  | 'almond'
  | 'wide'
  | 'gentle'
  | 'upturned'
  | 'downturned'
  | 'hooded'
  | 'monolid'
  | 'deepSet'
  | 'sleepy'
  | 'bright'
  | 'narrow';
export type EyeColorId = 'brown' | 'darkBrown' | 'hazel' | 'green' | 'blue' | 'gray';
export type EyebrowId = 'straight' | 'arched' | 'soft' | 'thick' | 'angled' | 'bushy';
export type NoseId = 'default' | 'narrow' | 'wide' | 'upturned' | 'straight' | 'rounded';
export type MouthId = 'neutral' | 'smile' | 'bigSmile' | 'soft' | 'smirk' | 'openSmile';
/** hair_01..hair_20 are plain numbered styles (deliberately unisex - no
 * gendered naming, any user can pick any of them); braid/bun/ponytail are
 * named only because avatarCatalog.ts's LONG_HAIR_IDS compatibility rule
 * needs to refer to "the long styles" by something more meaningful than a
 * number. */
export type HairId =
  | 'hair_01'
  | 'hair_02'
  | 'hair_03'
  | 'hair_04'
  | 'hair_05'
  | 'hair_06'
  | 'hair_07'
  | 'hair_08'
  | 'hair_09'
  | 'hair_10'
  | 'hair_11'
  | 'hair_12'
  | 'hair_13'
  | 'hair_14'
  | 'hair_15'
  | 'hair_16'
  | 'hair_17'
  | 'hair_18'
  | 'hair_19'
  | 'hair_20'
  | 'braid_01'
  | 'braid_02'
  | 'bun_01'
  | 'ponytail_01';
export type HairColorId = 'black' | 'darkBrown' | 'brown' | 'lightBrown' | 'auburn' | 'gray' | 'white';
/** Traditional Kyrgyz headwear ids are named (spec section 11) using only
 * their widely-known names - no invented historical/regional claims are
 * attached anywhere in code or copy. "none" plus "beanie"/"cap" are the
 * modern options, so a hoodie + ак калпак combination (spec's example) is
 * always possible. */
export type HeadwearId = 'none' | 'akKalpak' | 'tebetei' | 'elechek' | 'shokulo' | 'embroideredCap' | 'beanie' | 'cap';
/** Two groups per spec section 12: modern (hoodie..shirt) and Kyrgyz/ethno
 * (chapan..ethnoModernJacket) - freely mixable with any headwear. */
export type ClothingId =
  | 'hoodie'
  | 'tshirt'
  | 'sweater'
  | 'jacket'
  | 'shirt'
  | 'chapan'
  | 'embroideredVest'
  | 'traditionalDress'
  | 'traditionalShirt'
  | 'ethnoModernJacket';
export type AccessoryId = 'none' | 'glasses' | 'sunglasses' | 'earrings' | 'necklace' | 'ornamentalPin';
/** The 8 named backgrounds from spec section 14. */
export type BackgroundId =
  | 'beige'
  | 'alaTooMountains'
  | 'issykKul'
  | 'greenJailoo'
  | 'bozUyInterior'
  | 'shyrdakPattern'
  | 'darkGreen'
  | 'sunsetMountains';

/** One entry per illustrated-item customization category (i.e. every
 * AvatarConfig field except the 3 pure-color pickers - skinTone,
 * hairColor, eyeColor - which have swatches, not catalog items; see
 * avatarColors.ts). The UI groups several of these under one tab (e.g.
 * faceShape/eyebrows/nose/mouth all live on the "Face" tab alongside the
 * skinTone swatch row) - see src/features/avatar/data.ts for that
 * grouping. This list is the data-layer source of truth every catalog/
 * unlock/compatibility function operates on. */
export const AVATAR_CATEGORY_IDS = [
  'base',
  'faceShape',
  'eyebrows',
  'nose',
  'mouth',
  'body',
  'eyes',
  'hair',
  'headwear',
  'clothing',
  'accessory',
  'background',
] as const;

export type AvatarCategoryId = (typeof AVATAR_CATEGORY_IDS)[number];

export type AvatarConfig = {
  version: number;
  base: BaseId;
  skinTone: SkinToneId;
  faceShape: FaceShapeId;
  body: BodyId;
  eyes: EyeShapeId;
  eyeColor: EyeColorId;
  eyebrows: EyebrowId;
  nose: NoseId;
  mouth: MouthId;
  hair: HairId;
  hairColor: HairColorId;
  headwear: HeadwearId;
  clothing: ClothingId;
  accessory: AccessoryId;
  background: BackgroundId;
};

/** Field name on AvatarConfig for each catalog category - most categories
 * map 1:1 (categoryId === field name), skinTone/hairColor/eyeColor are
 * color-only pickers with no dedicated catalog "item" list (real hex
 * swatches instead, see avatarColors.ts) so they're outside
 * AVATAR_CATEGORY_IDS but still real AvatarConfig fields. */
export const AVATAR_CONFIG_FIELDS = [
  'base',
  'skinTone',
  'faceShape',
  'body',
  'eyes',
  'eyeColor',
  'eyebrows',
  'nose',
  'mouth',
  'hair',
  'hairColor',
  'headwear',
  'clothing',
  'accessory',
  'background',
] as const satisfies readonly (keyof AvatarConfig)[];

const REQUIRED_FIELDS: readonly (keyof AvatarConfig)[] = ['version', ...AVATAR_CONFIG_FIELDS];

/** Structural check only (right shape, right field types) - does not know
 * whether a given id still exists in the catalog. Use sanitizeAvatarConfig
 * (below) when reading a config that might reference a removed/renamed
 * item id. */
export function isValidAvatarConfig(value: unknown): value is AvatarConfig {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (typeof record.version !== 'number') return false;
  return REQUIRED_FIELDS.every((field) => field === 'version' || typeof record[field] === 'string');
}

/**
 * Defends against a saved config referencing an item id that no longer
 * exists in the catalog (a future catalog item removed/renamed) by
 * falling back to `defaults`'s value for that one field - never throws,
 * never drops the whole config over one bad field. `validIds` is injected
 * (not imported from avatarCatalog.ts here) to keep this file free of any
 * dependency on the catalog, so it stays trivially unit-testable with a
 * fabricated id set.
 */
export function sanitizeAvatarConfig(
  raw: Partial<AvatarConfig> | null | undefined,
  validIds: Record<AvatarCategoryId | 'skinTone' | 'hairColor' | 'eyeColor', ReadonlySet<string>>,
  defaults: AvatarConfig,
): AvatarConfig {
  const result = { ...defaults } as AvatarConfig;
  if (!raw || typeof raw !== 'object') return result;

  for (const field of AVATAR_CONFIG_FIELDS) {
    const value = raw[field];
    if (typeof value === 'string' && validIds[field]?.has(value)) {
      (result as unknown as Record<string, string>)[field] = value;
    }
  }
  return result;
}
