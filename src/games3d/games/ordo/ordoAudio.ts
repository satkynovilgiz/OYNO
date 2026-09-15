import { GameAudioManager } from '../../audio/GameAudioManager';

export type OrdoSfxSlot = 'pieceHit' | 'clear' | 'turnChange' | 'win' | 'loss' | 'draw';

/** CC0 (public domain) sound effects from Kenney.nl - see
 * `docs/GAME_ASSETS.md`'s "Sound Effects" table for the exact source file/
 * pack/license per slot. */
export function createOrdoAudio() {
  return new GameAudioManager<OrdoSfxSlot>({
    pieceHit: require('../../../../assets/audio/games/ordo/pieceHit.mp3'),
    clear: require('../../../../assets/audio/games/ordo/clear.mp3'),
    turnChange: require('../../../../assets/audio/games/ordo/turnChange.mp3'),
    win: require('../../../../assets/audio/games/ordo/win.mp3'),
    loss: require('../../../../assets/audio/games/ordo/loss.mp3'),
    draw: require('../../../../assets/audio/games/ordo/draw.mp3'),
  });
}
