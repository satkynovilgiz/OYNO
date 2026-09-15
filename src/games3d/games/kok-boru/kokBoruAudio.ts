import { GameAudioManager } from '../../audio/GameAudioManager';

export type KokBoruSfxSlot = 'pickup' | 'steal' | 'goalPlayer' | 'goalAi' | 'whistle';

/** CC0 (public domain) sound effects from Kenney.nl - see
 * `docs/GAME_ASSETS.md`'s "Sound Effects" table for the exact source file/
 * pack/license per slot. `whistle` is a bell-strike stand-in (no real
 * referee-whistle recording exists in the sourced CC0 packs) used as the
 * match-end signal - documented honestly rather than passed off as an
 * authentic whistle. */
export function createKokBoruAudio() {
  return new GameAudioManager<KokBoruSfxSlot>({
    pickup: require('../../../../assets/audio/games/kok-boru/pickup.mp3'),
    steal: require('../../../../assets/audio/games/kok-boru/steal.mp3'),
    goalPlayer: require('../../../../assets/audio/games/kok-boru/goalPlayer.mp3'),
    goalAi: require('../../../../assets/audio/games/kok-boru/goalAi.mp3'),
    whistle: require('../../../../assets/audio/games/kok-boru/whistle.mp3'),
  });
}
