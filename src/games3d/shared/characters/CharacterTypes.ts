/**
 * STATUS: STYLIZED_PROTOTYPE (Section 71 - do not claim more than this).
 *
 * Procedural stylized character system (Section 3, Option A: "procedural
 * stylized face" + Option C: "a simple base character system that can
 * later load production-quality GLB characters"). Built entirely from
 * Three.js primitives - no GLB/GLTF character models exist yet
 * (assets/models/ is empty; there was no way to author real 3D model
 * files in this pass, only code). Every part here is designed to be
 * swappable for a real mesh later without changing the calling code's
 * props (Section 10/62).
 *
 * Cultural identity is carried through clothing/hair/headwear colors and
 * shapes, never through facial geometry (Section 5: "Do not stereotype or
 * exaggerate facial features. Do not claim ethnicity from facial geometry
 * alone.") - head/face shape is identical across every variant; only
 * clothing, hair, and headwear vary.
 */

export type CharacterGender = 'male' | 'female';

/** Support is limited to what's achievable without morph targets/skeletal
 * animation (Section 9: "do not overbuild advanced facial animation yet") -
 * these swap simple mouth/eye geometry, not blend between them. */
export type CharacterExpression = 'neutral' | 'blink' | 'smile' | 'celebrate';

export type CharacterHairStyle = 'short' | 'braid' | 'covered';

export type CharacterVariant = {
  gender: CharacterGender;
  skinTone: string;
  hairColor: string;
  hairStyle: CharacterHairStyle;
  /** Tunic/chapan-inspired torso color. */
  clothingPrimary: string;
  /** Trim/belt/boots color. */
  clothingSecondary: string;
  /** Traditional-inspired felt cap - male-coded in this preset set, but the
   * flag is independent of `gender` so callers can mix and match. */
  wearsKalpak: boolean;
  /** Traditional-inspired white headwrap - independent of `gender` for the
   * same reason. */
  wearsElechek: boolean;
};

export const CHARACTER_PRESETS = {
  playerArcher: {
    gender: 'male',
    skinTone: '#E8C39E',
    hairColor: '#3B2A1E',
    hairStyle: 'short',
    clothingPrimary: '#3C6E47',
    clothingSecondary: '#8B6B3D',
    wearsKalpak: true,
    wearsElechek: false,
  },
  ordoOpponent: {
    gender: 'male',
    skinTone: '#D9AE7E',
    hairColor: '#241A12',
    hairStyle: 'short',
    clothingPrimary: '#7A3226',
    clothingSecondary: '#5C4326',
    wearsKalpak: false,
    wearsElechek: false,
  },
  kyzKuumaiPlayer: {
    gender: 'female',
    skinTone: '#E8C39E',
    hairColor: '#241A12',
    hairStyle: 'braid',
    clothingPrimary: '#B9793A',
    clothingSecondary: '#5C4326',
    wearsKalpak: false,
    wearsElechek: false,
  },
  kyzKuumaiRival: {
    gender: 'male',
    skinTone: '#C99568',
    hairColor: '#3B2A1E',
    hairStyle: 'covered',
    clothingPrimary: '#3D6E72',
    clothingSecondary: '#2B2019',
    wearsKalpak: true,
    wearsElechek: false,
  },
  kokBoruPlayer: {
    gender: 'male',
    skinTone: '#E0B48A',
    hairColor: '#2B2019',
    hairStyle: 'covered',
    clothingPrimary: '#2F5233',
    clothingSecondary: '#E8B93D',
    wearsKalpak: false,
    wearsElechek: false,
  },
} satisfies Record<string, CharacterVariant>;

export type CharacterPresetId = keyof typeof CHARACTER_PRESETS;
