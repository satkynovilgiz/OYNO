/**
 * Development-only frame-timing measurement for the 3D games.
 *
 * METHOD (keep in sync with docs/3D_GAMES.md "Performance baseline"):
 *   - Sample: the real `delta` react-three-fiber passes to `useFrame`, in
 *     milliseconds, i.e. the time between two RENDERED frames of the game's
 *     Canvas (not the JS thread, not requestAnimationFrame of RN).
 *   - Window: ACTIVE GAMEPLAY only - samples are recorded only while the
 *     game reports `active` (its phase is PLAYING and the Canvas is not
 *     paused). Loading, intro, countdown, pause menu, results and
 *     background time are excluded. The Canvas render loop is stopped
 *     while paused/backgrounded, so no frames arrive then at all.
 *   - The FIRST frame after every (re)activation is dropped: its delta
 *     spans the inactive time (resume after a pause would otherwise read
 *     as one multi-second frame).
 *   - Non-finite or non-positive deltas are ignored.
 *   - Median: the middle sorted sample (mean of the two middle ones for an
 *     even count). p95: nearest-rank - the sample at rank ceil(0.95 * n)
 *     in ascending order. Frame count: the number of kept samples.
 *   - At most MAX_SAMPLES samples are kept (ring buffer, newest win), so a
 *     long session reports its most recent ~minutes of gameplay.
 *
 * Nothing here is sent anywhere. Results are printed to the dev console
 * and kept in memory for the running dev session only.
 */

export const MAX_SAMPLES = 7200; // ~2 minutes at 60 fps

export type FrameStatsSummary = { frames: number; medianMs: number | null; p95Ms: number | null; maxMs: number | null };

export function percentileNearestRank(sortedAscending: readonly number[], percentile: number): number | null {
  if (sortedAscending.length === 0) return null;
  const rank = Math.ceil((percentile / 100) * sortedAscending.length);
  return sortedAscending[Math.min(sortedAscending.length, Math.max(1, rank)) - 1];
}

export function median(sortedAscending: readonly number[]): number | null {
  const n = sortedAscending.length;
  if (n === 0) return null;
  return n % 2 === 1 ? sortedAscending[(n - 1) / 2] : (sortedAscending[n / 2 - 1] + sortedAscending[n / 2]) / 2;
}

export function summarizeFrames(samplesMs: readonly number[]): FrameStatsSummary {
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const round = (value: number | null) => (value === null ? null : Math.round(value * 100) / 100);
  return { frames: sorted.length, medianMs: round(median(sorted)), p95Ms: round(percentileNearestRank(sorted, 95)), maxMs: round(sorted.length ? sorted[sorted.length - 1] : null) };
}

/** Records frame deltas for ONE game session; see the method above. */
export class FrameRecorder {
  private samples: number[] = [];
  private active = false;
  private skipNext = false;

  constructor(private readonly maxSamples: number = MAX_SAMPLES) {}

  /** Gameplay started / resumed (true) or left gameplay (false). */
  setActive(active: boolean): void {
    if (active && !this.active) this.skipNext = true;
    this.active = active;
  }

  /** One rendered frame; `deltaSeconds` exactly as useFrame provides it. */
  frame(deltaSeconds: number): void {
    if (!this.active) return;
    if (this.skipNext) {
      this.skipNext = false;
      return;
    }
    const ms = deltaSeconds * 1000;
    if (!Number.isFinite(ms) || ms <= 0) return;
    this.samples.push(ms);
    if (this.samples.length > this.maxSamples) this.samples.splice(0, this.samples.length - this.maxSamples);
  }

  summary(): FrameStatsSummary {
    return summarizeFrames(this.samples);
  }

  reset(): void {
    this.samples = [];
    this.skipNext = this.active;
  }
}

/** Dev-session results by game id (also reachable from the debugger). */
export const devFrameStats = new Map<string, FrameStatsSummary>();

export function formatFrameStats(gameId: string, summary: FrameStatsSummary): string {
  return `[FrameStats] ${gameId}: frames=${summary.frames} median=${summary.medianMs ?? '-'}ms p95=${summary.p95Ms ?? '-'}ms max=${summary.maxMs ?? '-'}ms (active gameplay only)`;
}
