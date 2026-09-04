import { createAudioPlayer, type AudioPlayer, type AudioSource } from 'expo-audio';

/** Fire-and-forget SFX manager shared across the 3D games (Section 60). Each
 * game defines its own slot union (e.g. 'draw' | 'release' | 'impact') and
 * passes a `{ slot: assetModule }` map - a slot with no asset registered
 * safely no-ops instead of throwing, so a game's call sites (haptics +
 * sound together, at the moment of drawing/releasing/impact) can be wired
 * once and real files dropped in later without touching game code. No SFX
 * assets exist yet for any of the 5 games - see docs/GAME_ASSETS.md; every
 * `play()` call below is currently a safe no-op. */
export class GameAudioManager<TSlot extends string> {
  private readonly sources: Partial<Record<TSlot, AudioSource>>;
  private readonly players = new Map<TSlot, AudioPlayer>();
  private muted = false;

  constructor(sources: Partial<Record<TSlot, AudioSource>>) {
    this.sources = sources;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  play(slot: TSlot, volume = 1) {
    if (this.muted) return;
    const source = this.sources[slot];
    if (!source) return;

    let player = this.players.get(slot);
    if (!player) {
      player = createAudioPlayer(source);
      this.players.set(slot, player);
    }
    player.volume = Math.max(0, Math.min(1, volume));
    player
      .seekTo(0)
      .then(() => player?.play())
      .catch(() => {});
  }

  dispose() {
    for (const player of this.players.values()) player.remove();
    this.players.clear();
  }
}
