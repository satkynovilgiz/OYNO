import { GameAudioManager } from '../../audio/GameAudioManager';

export type JaaAtuuSfxSlot = 'draw' | 'release' | 'impactLight' | 'impactMedium' | 'impactHeavy' | 'miss';

/** No recorded SFX yet for Jaa Atuu (see docs/GAME_ASSETS.md) - add entries
 * here once real files exist, e.g.
 * `release: require('@assets/audio/games/jaa-atuu/release.mp3')`. Every
 * call site in JaaAtuuGame.tsx is already wired against these slot names,
 * so dropping in files later needs no game-logic changes. */
export function createJaaAtuuAudio() {
  return new GameAudioManager<JaaAtuuSfxSlot>({});
}
