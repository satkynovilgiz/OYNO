import type { ImageSourcePropType } from 'react-native';

import bekAngry from '@assets/characters/bek/bek_angry.png';
import bekFocused from '@assets/characters/bek/bek_focused.png';
import bekHappy from '@assets/characters/bek/bek_happy.png';
import bekLaughing from '@assets/characters/bek/bek_laughing.png';
import bekSad from '@assets/characters/bek/bek_sad.png';
import bekSurprised from '@assets/characters/bek/bek_surprised.png';
import bekThinking from '@assets/characters/bek/bek_thinking.png';
import bekWinking from '@assets/characters/bek/bek_winking.png';

import aidanaAngry from '@assets/characters/aidana/aidana_angry.png';
import aidanaFocused from '@assets/characters/aidana/aidana_focused.png';
import aidanaHappy from '@assets/characters/aidana/aidana_happy.png';
import aidanaLaughing from '@assets/characters/aidana/aidana_laughing.png';
import aidanaSad from '@assets/characters/aidana/aidana_sad.png';
import aidanaSurprised from '@assets/characters/aidana/aidana_surprised.png';
import aidanaThinking from '@assets/characters/aidana/aidana_thinking.png';
import aidanaWinking from '@assets/characters/aidana/aidana_winking.png';

import aianaAngry from '@assets/characters/aiana/aiana_angry.png';
import aianaFocused from '@assets/characters/aiana/aiana_focused.png';
import aianaHappy from '@assets/characters/aiana/aiana_happy.png';
import aianaLaughing from '@assets/characters/aiana/aiana_laughing.png';
import aianaSad from '@assets/characters/aiana/aiana_sad.png';
import aianaSurprised from '@assets/characters/aiana/aiana_surprised.png';
import aianaThinking from '@assets/characters/aiana/aiana_thinking.png';
import aianaWinking from '@assets/characters/aiana/aiana_winking.png';

export type CharacterEmotion =
  | 'happy'
  | 'laughing'
  | 'angry'
  | 'sad'
  | 'surprised'
  | 'focused'
  | 'winking'
  | 'thinking';

/** All characters the app knows about, including ones with no art yet. */
export type CharacterId = 'bek' | 'aidana' | 'aiana' | 'boru' | 'tulpar' | 'elchi';

export const CHARACTER_NAMES: Record<CharacterId, string> = {
  bek: 'Бек',
  aidana: 'Айдана',
  aiana: 'Аяна',
  boru: 'Бөрү',
  tulpar: 'Тулпар',
  elchi: 'Элчи',
};

/**
 * Only characters with a full 8-emotion sliced sheet appear here. Бөрү,
 * Тулпар, and Элчи have no sheet - and no portrait at all yet, verified
 * against assets/characters/ - so CharacterAvatar falls back to an
 * initial-letter placeholder for them instead of a missing require().
 */
const characterEmotionAssets: Partial<Record<CharacterId, Record<CharacterEmotion, ImageSourcePropType>>> = {
  bek: {
    happy: bekHappy,
    laughing: bekLaughing,
    angry: bekAngry,
    sad: bekSad,
    surprised: bekSurprised,
    focused: bekFocused,
    winking: bekWinking,
    thinking: bekThinking,
  },
  aidana: {
    happy: aidanaHappy,
    laughing: aidanaLaughing,
    angry: aidanaAngry,
    sad: aidanaSad,
    surprised: aidanaSurprised,
    focused: aidanaFocused,
    winking: aidanaWinking,
    thinking: aidanaThinking,
  },
  aiana: {
    happy: aianaHappy,
    laughing: aianaLaughing,
    angry: aianaAngry,
    sad: aianaSad,
    surprised: aianaSurprised,
    focused: aianaFocused,
    winking: aianaWinking,
    thinking: aianaThinking,
  },
};

export const CHARACTERS_WITH_FULL_SHEET: CharacterId[] = ['bek', 'aidana', 'aiana'];

export function getCharacterEmotionAsset(
  characterId: CharacterId,
  emotion: CharacterEmotion,
): ImageSourcePropType | null {
  return characterEmotionAssets[characterId]?.[emotion] ?? null;
}
