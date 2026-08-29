import type { ImageSourcePropType } from 'react-native';

import bustBoy from '@assets/img/OYNO_design/avatar/bust_boy.png';
import bustGirl from '@assets/img/OYNO_design/avatar/bust_girl.png';
import faceshapeOval from '@assets/img/OYNO_design/avatar/faceshape_oval.png';
import faceshapeRound from '@assets/img/OYNO_design/avatar/faceshape_round.png';
import faceshapeSquare from '@assets/img/OYNO_design/avatar/faceshape_square.png';
import faceshapeLong from '@assets/img/OYNO_design/avatar/faceshape_long.png';
import faceshapeSoftAngular from '@assets/img/OYNO_design/avatar/faceshape_softAngular.png';
import faceshapeWide from '@assets/img/OYNO_design/avatar/faceshape_wide.png';
import hair01 from '@assets/img/OYNO_design/avatar/hair_01.png';
import hair02 from '@assets/img/OYNO_design/avatar/hair_02.png';
import hair03 from '@assets/img/OYNO_design/avatar/hair_03.png';
import hair04 from '@assets/img/OYNO_design/avatar/hair_04.png';
import hair05 from '@assets/img/OYNO_design/avatar/hair_05.png';
import hair06 from '@assets/img/OYNO_design/avatar/hair_06.png';
import eyebrowsStraight from '@assets/img/OYNO_design/avatar/eyebrows_straight.png';
import eyebrowsArched from '@assets/img/OYNO_design/avatar/eyebrows_arched.png';
import eyebrowsSoft from '@assets/img/OYNO_design/avatar/eyebrows_soft.png';
import eyebrowsThick from '@assets/img/OYNO_design/avatar/eyebrows_thick.png';
import eyebrowsAngled from '@assets/img/OYNO_design/avatar/eyebrows_angled.png';
import eyebrowsBushy from '@assets/img/OYNO_design/avatar/eyebrows_bushy.png';
import noseDefault from '@assets/img/OYNO_design/avatar/nose_default.png';
import noseNarrow from '@assets/img/OYNO_design/avatar/nose_narrow.png';
import noseWide from '@assets/img/OYNO_design/avatar/nose_wide.png';
import noseUpturned from '@assets/img/OYNO_design/avatar/nose_upturned.png';
import noseStraight from '@assets/img/OYNO_design/avatar/nose_straight.png';
import noseRounded from '@assets/img/OYNO_design/avatar/nose_rounded.png';
import mouthNeutral from '@assets/img/OYNO_design/avatar/mouth_neutral.png';
import mouthSmile from '@assets/img/OYNO_design/avatar/mouth_smile.png';
import mouthBigSmile from '@assets/img/OYNO_design/avatar/mouth_bigSmile.png';
import mouthSoft from '@assets/img/OYNO_design/avatar/mouth_soft.png';
import mouthSmirk from '@assets/img/OYNO_design/avatar/mouth_smirk.png';
import mouthOpenSmile from '@assets/img/OYNO_design/avatar/mouth_openSmile.png';

import type { AvatarCategoryId, BaseId } from './avatarConfig';

/**
 * Real (non-placeholder) illustrated art, sliced from the two reference
 * mockups the product owner supplied (ProfilePicsChagerDesign{Boy,Girl}.jpg
 * - see supabase/migrations' sibling implementation-plan notes for
 * provenance). Deliberately NOT a full composited layer system (spec §5) -
 * each entry here is a single flattened icon used only inside ItemCard's
 * picker grid, the same limited scope avatarCatalog.ts's `isPlaceholder`
 * flag already documents. Every id below has isPlaceholder:false set in
 * avatarCatalog.ts to match. `bust_boy`/`bust_girl` are not wired into the
 * live AvatarPreview/UserAvatar via AvatarConfig's `base` field - see
 * those two components for the important caveat that this is one static
 * baked portrait (with its own fixed hat/clothing), not a composite of
 * the user's actual headwear/clothing/hair selections.
 */
const ITEM_ART: Partial<Record<string, ImageSourcePropType>> = {
  base_male: bustBoy,
  base_female: bustGirl,
  faceShape_oval: faceshapeOval,
  faceShape_round: faceshapeRound,
  faceShape_square: faceshapeSquare,
  faceShape_long: faceshapeLong,
  faceShape_softAngular: faceshapeSoftAngular,
  faceShape_wide: faceshapeWide,
  hair_hair_01: hair01,
  hair_hair_02: hair02,
  hair_hair_03: hair03,
  hair_hair_04: hair04,
  hair_hair_05: hair05,
  hair_hair_06: hair06,
  eyebrows_straight: eyebrowsStraight,
  eyebrows_arched: eyebrowsArched,
  eyebrows_soft: eyebrowsSoft,
  eyebrows_thick: eyebrowsThick,
  eyebrows_angled: eyebrowsAngled,
  eyebrows_bushy: eyebrowsBushy,
  nose_default: noseDefault,
  nose_narrow: noseNarrow,
  nose_wide: noseWide,
  nose_upturned: noseUpturned,
  nose_straight: noseStraight,
  nose_rounded: noseRounded,
  mouth_neutral: mouthNeutral,
  mouth_smile: mouthSmile,
  mouth_bigSmile: mouthBigSmile,
  mouth_soft: mouthSoft,
  mouth_smirk: mouthSmirk,
  mouth_openSmile: mouthOpenSmile,
};

/** Direct, typed lookup for the two base portraits - used by
 * AvatarPreview/UserAvatar, which key off AvatarConfig['base'] directly
 * rather than going through the generic category/item-id lookup below. */
export const AVATAR_BUST_ART: Record<BaseId, ImageSourcePropType> = { male: bustBoy, female: bustGirl };

export function getAvatarItemArt(categoryId: AvatarCategoryId, itemId: string): ImageSourcePropType | null {
  return ITEM_ART[`${categoryId}_${itemId}`] ?? null;
}
