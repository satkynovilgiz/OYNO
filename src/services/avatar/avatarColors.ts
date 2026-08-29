import type { EyeColorId, HairColorId, SkinToneId } from './avatarConfig';

/**
 * Real, finished color swatches - no illustration needed, unlike the rest
 * of the catalog (see avatarCatalog.ts's isPlaceholder flag). Deliberately
 * separate from src/theme/colors.ts, which is UI chrome (buttons,
 * backgrounds), not body/skin/hair tones.
 */

export const SKIN_TONE_SWATCHES: { id: SkinToneId; hex: string }[] = [
  { id: 'skin_01', hex: '#FDE3C5' },
  { id: 'skin_02', hex: '#F6C89F' },
  { id: 'skin_03', hex: '#E3A876' },
  { id: 'skin_04', hex: '#C98554' },
  { id: 'skin_05', hex: '#9C6238' },
  { id: 'skin_06', hex: '#6B4226' },
];

export const HAIR_COLOR_SWATCHES: { id: HairColorId; hex: string }[] = [
  { id: 'black', hex: '#1C1410' },
  { id: 'darkBrown', hex: '#3B2417' },
  { id: 'brown', hex: '#5C3A21' },
  { id: 'lightBrown', hex: '#8A5A34' },
  { id: 'auburn', hex: '#7A3B24' },
  { id: 'gray', hex: '#9A958E' },
  { id: 'white', hex: '#E8E3DC' },
];

export const EYE_COLOR_SWATCHES: { id: EyeColorId; hex: string }[] = [
  { id: 'brown', hex: '#6B4226' },
  { id: 'darkBrown', hex: '#2E1E12' },
  { id: 'hazel', hex: '#8A6A3B' },
  { id: 'green', hex: '#5B7A52' },
  { id: 'blue', hex: '#4A6FA5' },
  { id: 'gray', hex: '#7C868F' },
];

export function skinToneHex(id: SkinToneId): string {
  return SKIN_TONE_SWATCHES.find((s) => s.id === id)?.hex ?? SKIN_TONE_SWATCHES[2].hex;
}

export function hairColorHex(id: HairColorId): string {
  return HAIR_COLOR_SWATCHES.find((s) => s.id === id)?.hex ?? HAIR_COLOR_SWATCHES[0].hex;
}

export function eyeColorHex(id: EyeColorId): string {
  return EYE_COLOR_SWATCHES.find((s) => s.id === id)?.hex ?? EYE_COLOR_SWATCHES[0].hex;
}
