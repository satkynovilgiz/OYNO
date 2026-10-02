import type { RhythmChart } from './rhythmModel';

/**
 * Manually authored beat charts. EMPTY on purpose: a chart must be tapped
 * along by a person (the dev "Author a chart" tool on the rhythm screen),
 * listened back and confirmed (`reviewed: true`) before it is offered.
 * Charts are never generated from the audio. Until one exists, the
 * Listening Room hides "Practice rhythm".
 */
export const RHYTHM_CHARTS: RhythmChart[] = [];
