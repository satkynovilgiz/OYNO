import { GameAudioManager } from '@/games3d/audio/GameAudioManager';

/**
 * The example's sound reuses the games' existing SFX manager (no second
 * audio engine) with an existing licensed wooden-tap sample (Kenney Impact
 * Sounds `impactWood_light_000`, CC0 - docs/GAME_ASSETS.md). Two slots
 * alternate on the same file so quick notes don't cut each other off. The
 * manager already respects the global sound-effects setting.
 */
type Slot = 'note' | 'noteAlt';
export function createRepeatAudio() {
  const source = require('../../../../../../assets/audio/games/ordo/pieceHit.mp3');
  return new GameAudioManager<Slot>({ note: source, noteAlt: source });
}

export type Clock = () => number;
export type Timers = { set: (callback: () => void, ms: number) => unknown; clear: (handle: unknown) => void };
const realTimers: Timers = { set: (callback, ms) => setTimeout(callback, ms), clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>) };

/** Lead-in before the first note, so the first one isn't missed. */
export const LEAD_IN_MS = 600;
/** Silence after the last note before "your turn". */
export const TAIL_MS = 500;

/**
 * Plays an example: `onNote(index)` at each note, `onDone()` after the
 * last. Every timeout is measured from one monotonic start, so delays never
 * accumulate. The returned cancel stops everything still pending (leaving,
 * backgrounding, replay) - nothing sounds after it.
 */
export function playExample(times: readonly number[], handlers: { onNote: (index: number) => void; onDone: () => void }, clock: Clock = () => performance.now(), timers: Timers = realTimers): () => void {
  const start = clock() + LEAD_IN_MS;
  const pending = new Set<unknown>();
  let cancelled = false;
  const at = (offset: number, callback: () => void) => {
    const handle = timers.set(() => {
      pending.delete(handle);
      if (!cancelled) callback();
    }, Math.max(0, start + offset - clock()));
    pending.add(handle);
  };
  times.forEach((time, index) => at(time, () => handlers.onNote(index)));
  at((times[times.length - 1] ?? 0) + TAIL_MS, handlers.onDone);
  return () => {
    cancelled = true;
    for (const handle of pending) timers.clear(handle);
    pending.clear();
  };
}
