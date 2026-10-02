/**
 * Komuz Rhythm Trainer - pure timing rules. Beats come ONLY from manually
 * authored charts (rhythmCharts.ts); nothing is inferred from the audio at
 * runtime. Timing is judged in broad, forgiving windows because the app's
 * audio clock (expo-audio status updates) is not millisecond-precise -
 * results are categories (Perfect / Good / Miss), never "3 ms late".
 */

export type RhythmChart = {
  trackId: string;
  /** Seconds from track start, ascending. */
  beats: number[];
  bpm?: number;
  /** Who authored it (always a person - "tap along" in the dev tool). */
  authoredBy: string;
  /** Only charts a person has listened back to and confirmed are offered. */
  reviewed: boolean;
};

export type Grade = 'perfect' | 'good';

/** Forgiving mobile windows (seconds either side of a beat). */
export const PERFECT_WINDOW = 0.1;
export const GOOD_WINDOW = 0.22;

export function validateChart(chart: RhythmChart, trackIds: readonly string[], duration?: number | null): string[] {
  const problems: string[] = [];
  if (!trackIds.includes(chart.trackId)) problems.push(`unknown track ${chart.trackId}`);
  if (chart.beats.length < 8) problems.push('fewer than 8 beats');
  for (let i = 0; i < chart.beats.length; i++) {
    const beat = chart.beats[i];
    if (!Number.isFinite(beat) || beat < 0) problems.push(`beat ${i} invalid`);
    if (i > 0 && beat <= chart.beats[i - 1]) problems.push(`beat ${i} not after the previous one`);
    if (duration && beat > duration) problems.push(`beat ${i} after the track ends`);
  }
  if (!chart.authoredBy.trim()) problems.push('no author');
  return problems;
}

/** Charts that can be offered: reviewed, valid, for an existing track. */
export function supportedCharts(charts: readonly RhythmChart[], trackIds: readonly string[]): RhythmChart[] {
  return charts.filter((chart) => chart.reviewed && validateChart(chart, trackIds).length === 0);
}

export type RoundState = { judged: Record<number, Grade>; strayTaps: number };
export const NEW_ROUND: RoundState = { judged: {}, strayTaps: 0 };

/**
 * One tap at `time` seconds: matched to the NEAREST not-yet-judged beat
 * within the Good window. A beat can be scored once - a second tap on it
 * counts as a stray tap, never a second hit.
 */
export function judgeTap(beats: readonly number[], round: RoundState, time: number): { round: RoundState; grade: Grade | null; beatIndex: number | null } {
  let best: number | null = null;
  for (let i = 0; i < beats.length; i++) {
    if (round.judged[i]) continue;
    const distance = Math.abs(beats[i] - time);
    if (distance <= GOOD_WINDOW && (best === null || distance < Math.abs(beats[best] - time))) best = i;
  }
  if (best === null) return { round: { ...round, strayTaps: round.strayTaps + 1 }, grade: null, beatIndex: null };
  const grade: Grade = Math.abs(beats[best] - time) <= PERFECT_WINDOW ? 'perfect' : 'good';
  return { round: { ...round, judged: { ...round.judged, [best]: grade } }, grade, beatIndex: best };
}

/** Beats whose window has fully passed without a hit. */
export function missedBeats(beats: readonly number[], round: RoundState, now: number): number {
  return beats.filter((beat, index) => !round.judged[index] && now - beat > GOOD_WINDOW).length;
}

export type RoundResult = { total: number; hit: number; perfect: number; good: number; missed: number };

export function roundResult(beats: readonly number[], round: RoundState): RoundResult {
  const grades = Object.values(round.judged);
  const perfect = grades.filter((grade) => grade === 'perfect').length;
  const good = grades.filter((grade) => grade === 'good').length;
  return { total: beats.length, hit: perfect + good, perfect, good, missed: beats.length - perfect - good };
}

/** The next beats to draw as incoming pulses (visual cue, not audio-only). */
export function upcomingBeats(beats: readonly number[], now: number, lookahead = 2): number[] {
  return beats.filter((beat) => beat >= now - GOOD_WINDOW && beat <= now + lookahead);
}
