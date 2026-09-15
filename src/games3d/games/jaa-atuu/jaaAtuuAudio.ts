import { GameAudioManager } from '../../audio/GameAudioManager';

export type JaaAtuuSfxSlot = 'draw' | 'release' | 'impactLight' | 'impactMedium' | 'impactHeavy' | 'miss' | 'result';

/** CC0 (public domain) sound effects from Kenney.nl - see
 * `docs/GAME_ASSETS.md`'s "Sound Effects" table for the exact source file/
 * pack/license per slot. `draw`/`release` are stylized foley stand-ins
 * (no real bow recording exists in the sourced CC0 packs), not literal bow
 * audio - documented honestly rather than passed off as authentic. */
export function createJaaAtuuAudio() {
  return new GameAudioManager<JaaAtuuSfxSlot>({
    draw: require('../../../../assets/audio/games/jaa-atuu/draw.mp3'),
    release: require('../../../../assets/audio/games/jaa-atuu/release.mp3'),
    impactLight: require('../../../../assets/audio/games/jaa-atuu/impactLight.mp3'),
    impactMedium: require('../../../../assets/audio/games/jaa-atuu/impactMedium.mp3'),
    impactHeavy: require('../../../../assets/audio/games/jaa-atuu/impactHeavy.mp3'),
    miss: require('../../../../assets/audio/games/jaa-atuu/miss.mp3'),
    result: require('../../../../assets/audio/games/jaa-atuu/result.mp3'),
  });
}
