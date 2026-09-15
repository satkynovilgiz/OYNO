import { createAudioPlayer, type AudioPlayer, type AudioSource } from 'expo-audio';

import { useSettingsStore } from '@/store/useSettingsStore';

/** Fire-and-forget SFX manager shared across the 3D games (Section 60). Each
 * game defines its own slot union (e.g. 'draw' | 'release' | 'impact') and
 * passes a `{ slot: assetModule }` map - a slot with no asset registered
 * safely no-ops instead of throwing, so a game's call sites (haptics +
 * sound together, at the moment of drawing/releasing/impact) can be wired
 * once and real files dropped in later without touching game code.
 *
 * Every game now has a real, licensed CC0 asset per slot - see
 * `docs/GAME_ASSETS.md`'s "Sound Effects" table for the source/license of
 * every file. `play()` always checks the shared `useSettingsStore().game.
 * soundEffects` toggle (not just this instance's own `muted`), so a game
 * doesn't need to thread the global setting through every call site itself
 * to "respect mute/sound settings." */
export class GameAudioManager<TSlot extends string> {
  private readonly sources: Partial<Record<TSlot, AudioSource>>;
  private readonly players = new Map<TSlot, AudioPlayer>();
  private muted = false;

  constructor(sources: Partial<Record<TSlot, AudioSource>>) {
    this.sources = sources;
  }

  /** Instance-level override (e.g. muting during a cutscene) - independent
   * of the global sound-effects setting, which is always checked too. */
  setMuted(muted: boolean) {
    this.muted = muted;
  }

  play(slot: TSlot, volume = 1) {
    if (this.muted) return;
    if (!useSettingsStore.getState().game.soundEffects) return;
    const source = this.sources[slot];
    if (!source) return;

    try {
      let player = this.players.get(slot);
      if (!player) {
        player = createAudioPlayer(source);
        this.players.set(slot, player);
      }
      // Capped below 1.0 (Section "don't play every sound too loudly") -
      // every call site already passes a conservative per-event volume on
      // top of this ceiling.
      player.volume = Math.max(0, Math.min(0.85, volume));
      player
        .seekTo(0)
        .then(() => player?.play())
        .catch(() => {});
    } catch {
      // Some platforms/simulators have no usable audio output device -
      // sound is a nice-to-have here, never worth crashing a game over.
    }
  }

  dispose() {
    for (const player of this.players.values()) player.remove();
    this.players.clear();
  }
}
