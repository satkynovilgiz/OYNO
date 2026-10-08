/**
 * "Repeat the Rhythm" - pure rules (no timers, no audio).
 *
 * The six patterns are AUTHORED PRACTICE EXERCISES written for this mode.
 * They are not traditional komuz rhythms and are never labelled as such.
 *
 * Timing is judged RELATIVELY, so a slow and a fast performance of the same
 * pattern score the same:
 *  1. Double taps (closer than DOUBLE_TAP_MS) are ignored - they never shift
 *     or add beats.
 *  2. Tap k is matched to beat k (in order). A round ends once every beat
 *     has a tap (or by `finish`), so taps can never outnumber beats.
 *  3. The player's own tempo and start are fitted (least squares,
 *     tap ms = a + b * beat). Each tap's deviation is then measured in
 *     BEATS of that tempo - not milliseconds.
 *  4. |deviation| <= ON_TIME_BEATS -> on time (2 points),
 *     <= CLOSE_BEATS -> close (1), otherwise off (0); no tap -> missing (0).
 *  5. Fewer than half the beats tapped -> no timing credit (two taps would
 *     always "fit" perfectly).
 * Tempo is reported (slower / steady / faster) but never scored.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export type PatternId = 'even' | 'pairs' | 'long-short' | 'run' | 'offbeat' | 'skip';
/** Onsets in beats from the first note (first is always 0). */
export const PATTERNS: Record<PatternId, number[]> = {
  even: [0, 1, 2, 3],
  pairs: [0, 0.5, 1, 2, 2.5, 3],
  'long-short': [0, 1.5, 2, 3],
  run: [0, 0.5, 1, 1.5, 2, 3],
  offbeat: [0, 1, 1.5, 2.5, 3],
  skip: [0, 0.5, 1.5, 2, 3, 3.5],
};
export const PATTERN_IDS = Object.keys(PATTERNS) as PatternId[];

export const LEVELS: Record<Difficulty, { bpm: number; patterns: PatternId[] }> = {
  easy: { bpm: 70, patterns: ['even', 'long-short', 'pairs'] },
  medium: { bpm: 85, patterns: ['pairs', 'long-short', 'run', 'offbeat'] },
  hard: { bpm: 100, patterns: ['run', 'offbeat', 'skip'] },
};

export const ROUNDS = 5;
export const ON_TIME_BEATS = 0.12;
export const CLOSE_BEATS = 0.25;
/** Two taps closer than this are one bounce of a finger, not two notes. */
export const DOUBLE_TAP_MS = 80;
/** Fitted tempo vs. the example: outside these ratios it is called slower / faster. */
export const TEMPO_SLOWER = 1.15;
export const TEMPO_FASTER = 0.87;
export const POINTS = { onTime: 2, close: 1, off: 0, missing: 0 } as const;

export const beatMs = (bpm: number) => 60000 / bpm;
/** When each note of the example sounds, in ms from its start. */
export const exampleTimes = (pattern: PatternId, bpm: number) => PATTERNS[pattern].map((beat) => beat * beatMs(bpm));

export type BeatGrade = 'onTime' | 'close' | 'off' | 'missing';
export type BeatResult = { grade: BeatGrade; /** beats; negative = early. null when missing. */ deviation: number | null };
export type RoundScore = { pattern: PatternId; beats: BeatResult[]; points: number; maxPoints: number; tempo: 'slower' | 'steady' | 'faster' | null; ignoredTaps: number };

export function scoreTaps(pattern: PatternId, bpm: number, taps: readonly number[], ignoredTaps = 0): RoundScore {
  return { ...scoreOnsets(PATTERNS[pattern], bpm, taps, ignoredTaps), pattern };
}

/** The same relative-timing rules for any onsets (beats from the first note) - used by the Rhythm Workshop. */
export function scoreOnsets(onsets: readonly number[], bpm: number, taps: readonly number[], ignoredTaps = 0): Omit<RoundScore, 'pattern'> & { pattern: PatternId | null } {
  const pattern = null;
  const used = taps.slice(0, onsets.length);
  const maxPoints = onsets.length * POINTS.onTime;
  const missing = (): BeatResult => ({ grade: 'missing', deviation: null });
  if (used.length < Math.max(2, Math.ceil(onsets.length / 2))) {
    return { pattern, beats: onsets.map((_, index) => (index < used.length ? { grade: 'off', deviation: null } : missing())), points: 0, maxPoints, tempo: null, ignoredTaps };
  }
  // Least-squares fit of tap time against beat position.
  const xs = onsets.slice(0, used.length);
  const meanX = xs.reduce((sum, x) => sum + x, 0) / xs.length;
  const meanY = used.reduce((sum, y) => sum + y, 0) / used.length;
  const sxx = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0);
  const sxy = xs.reduce((sum, x, index) => sum + (x - meanX) * (used[index] - meanY), 0);
  const slope = sxy / sxx; // ms per beat, the player's own tempo
  const intercept = meanY - slope * meanX;
  const beats = onsets.map((x, index): BeatResult => {
    if (index >= used.length) return missing();
    if (!(slope > 0)) return { grade: 'off', deviation: null };
    const deviation = (used[index] - (intercept + slope * x)) / slope;
    const size = Math.abs(deviation);
    return { grade: size <= ON_TIME_BEATS ? 'onTime' : size <= CLOSE_BEATS ? 'close' : 'off', deviation: Math.round(deviation * 1000) / 1000 };
  });
  const ratio = slope / beatMs(bpm);
  return {
    pattern,
    beats,
    points: beats.reduce((sum, beat) => sum + POINTS[beat.grade], 0),
    maxPoints,
    tempo: !(slope > 0) ? null : ratio > TEMPO_SLOWER ? 'slower' : ratio < TEMPO_FASTER ? 'faster' : 'steady',
    ignoredTaps,
  };
}

export type Rng = () => number;
/** Five rounds from the level's patterns: each pattern before any repeats, never the same twice in a row. */
export function buildRounds(difficulty: Difficulty, rng: Rng): PatternId[] {
  const pool = LEVELS[difficulty].patterns;
  const out: PatternId[] = [];
  while (out.length < ROUNDS) {
    const order = [...pool];
    for (let index = order.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(rng() * (index + 1));
      [order[index], order[swap]] = [order[swap], order[index]];
    }
    if (out.length > 0 && order[0] === out[out.length - 1] && order.length > 1) [order[0], order[1]] = [order[1], order[0]];
    out.push(...order);
  }
  return out.slice(0, ROUNDS);
}

/**
 * listen   - the example plays (taps ignored)
 * ready    - waiting for the first tap
 * tapping  - collecting taps
 * feedback - this round's result
 * paused   - interrupted (background / leaving); the round restarts from listen
 * summary  - all five rounds done
 */
export type Phase = 'listen' | 'ready' | 'tapping' | 'feedback' | 'paused' | 'summary';
export type SessionState = { difficulty: Difficulty; rounds: PatternId[]; index: number; phase: Phase; taps: number[]; ignoredTaps: number; results: RoundScore[] };

export type SessionAction =
  | { type: 'demoDone' }
  | { type: 'replay' }
  | { type: 'tap'; at: number }
  | { type: 'finish' }
  | { type: 'next' }
  | { type: 'interrupt' }
  | { type: 'restart' };

export function startSession(difficulty: Difficulty, rounds: PatternId[]): SessionState {
  return { difficulty, rounds, index: 0, phase: 'listen', taps: [], ignoredTaps: 0, results: [] };
}

const pattern = (state: SessionState) => state.rounds[state.index];

function scored(state: SessionState): SessionState {
  const result = scoreTaps(pattern(state), LEVELS[state.difficulty].bpm, state.taps, state.ignoredTaps);
  return { ...state, phase: 'feedback', results: [...state.results.slice(0, state.index), result] };
}

/** Every transition. Out-of-phase actions change nothing, so double taps, late taps or repeated "finish" can never add points. */
export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'demoDone':
      return state.phase === 'listen' ? { ...state, phase: 'ready' } : state;
    case 'replay':
      // Hearing the example again discards a half-tapped attempt. (After feedback the
      // screen just replays the sound; the result stays as it was.)
      return state.phase === 'ready' || state.phase === 'tapping' ? { ...state, phase: 'listen', taps: [], ignoredTaps: 0 } : state;
    case 'tap': {
      if (!Number.isFinite(action.at)) return state;
      if (state.phase === 'ready') return { ...state, phase: 'tapping', taps: [action.at], ignoredTaps: 0 };
      if (state.phase !== 'tapping') return state;
      const last = state.taps[state.taps.length - 1];
      if (action.at < last) return state; // not monotonic: never trusted
      if (action.at - last < DOUBLE_TAP_MS) return { ...state, ignoredTaps: state.ignoredTaps + 1 };
      const next = { ...state, taps: [...state.taps, action.at] };
      return next.taps.length >= PATTERNS[pattern(state)].length ? scored(next) : next;
    }
    case 'finish':
      return state.phase === 'tapping' ? scored(state) : state;
    case 'next':
      if (state.phase !== 'feedback') return state;
      return state.index + 1 >= state.rounds.length ? { ...state, phase: 'summary' } : { ...state, index: state.index + 1, phase: 'listen', taps: [], ignoredTaps: 0 };
    case 'interrupt':
      return state.phase === 'listen' || state.phase === 'ready' || state.phase === 'tapping' ? { ...state, phase: 'paused', taps: [], ignoredTaps: 0 } : state;
    case 'restart':
      return state.phase === 'paused' ? { ...state, phase: 'listen', taps: [], ignoredTaps: 0 } : state;
  }
}

export type SessionSummary = { points: number; maxPoints: number; onTime: number; close: number; off: number; missing: number; rounds: number };
export function summarize(state: SessionState): SessionSummary {
  const beats = state.results.flatMap((result) => result.beats);
  const count = (grade: BeatGrade) => beats.filter((beat) => beat.grade === grade).length;
  return {
    points: state.results.reduce((sum, result) => sum + result.points, 0),
    maxPoints: state.results.reduce((sum, result) => sum + result.maxPoints, 0),
    onTime: count('onTime'),
    close: count('close'),
    off: count('off'),
    missing: count('missing'),
    rounds: state.results.length,
  };
}
