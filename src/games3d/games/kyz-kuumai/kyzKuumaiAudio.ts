import { GameAudioManager } from '../../audio/GameAudioManager';

export type KyzKuumaiSfxSlot = 'hoofbeat' | 'checkpoint' | 'sprint' | 'finish';

/** CC0 (public domain) sound effects from Kenney.nl - see
 * `docs/GAME_ASSETS.md`'s "Sound Effects" table for the exact source file/
 * pack/license per slot. `hoofbeat` is a grass-footstep foley (closest
 * available stand-in in the sourced CC0 packs - not a real horse hoof
 * recording) played on a throttle while the horse is moving, since
 * `GameAudioManager` is fire-and-forget/one-shot, not a loop player. */
export function createKyzKuumaiAudio() {
  return new GameAudioManager<KyzKuumaiSfxSlot>({
    hoofbeat: require('../../../../assets/audio/games/kyz-kuumai/hoofbeat.mp3'),
    checkpoint: require('../../../../assets/audio/games/kyz-kuumai/checkpoint.mp3'),
    sprint: require('../../../../assets/audio/games/kyz-kuumai/sprint.mp3'),
    finish: require('../../../../assets/audio/games/kyz-kuumai/finish.mp3'),
  });
}
