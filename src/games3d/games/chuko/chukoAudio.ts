import { GameAudioManager } from '../../audio/GameAudioManager';

export type ChukoSfxSlot = 'throw' | 'land' | 'success' | 'loss' | 'draw';

/** CC0 (public domain) sound effects from Kenney.nl - see
 * `docs/GAME_ASSETS.md`'s "Sound Effects" table for the exact source file/
 * pack/license per slot. `loss`/`draw` reuse the same files as Ordo's
 * result sounds for consistency (Chuko reuses Ordo's whole rules/physics
 * shape - see docs/3D_GAMES.md - so its win/loss/draw framing matches too),
 * even though only "throw"/"pieces hitting ground"/"successful result" were
 * explicitly requested for Chuko. */
export function createChukoAudio() {
  return new GameAudioManager<ChukoSfxSlot>({
    throw: require('../../../../assets/audio/games/chuko/throw.mp3'),
    land: require('../../../../assets/audio/games/chuko/land.mp3'),
    success: require('../../../../assets/audio/games/chuko/success.mp3'),
    loss: require('../../../../assets/audio/games/chuko/loss.mp3'),
    draw: require('../../../../assets/audio/games/chuko/draw.mp3'),
  });
}
