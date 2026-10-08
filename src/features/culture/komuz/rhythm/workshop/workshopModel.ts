import { beatMs, DOUBLE_TAP_MS, scoreOnsets } from '../repeat/repeatModel';

/**
 * Rhythm Workshop - compose a short rhythm on a bounded grid, then hand the
 * phone over: the other person hears it (the answer is hidden) and taps it
 * back. Scored with Repeat the Rhythm's RELATIVE-timing rules (scoreOnsets),
 * which measure timing similarity only - not musical skill.
 *
 * Grid: 16 steps of half a beat (8 beats), one sound (the workshop's
 * wooden tap). A composition is 2-12 notes; the first note is the start.
 * Compositions are the person's own practice exercises - not komuz music.
 */
export const STEPS = 16;
export const STEP_BEATS = 0.5;
export const MIN_NOTES = 2;
export const MAX_NOTES = 12;
export const TEMPOS = [70, 85, 100] as const;
export type Tempo = (typeof TEMPOS)[number];

/** Which grid steps sound (sorted, unique, 0..STEPS-1). */
export type Composition = { steps: number[]; tempo: Tempo };
export const EMPTY_COMPOSITION: Composition = { steps: [], tempo: 85 };

/** Three authored examples (written for OYNO as practice; not traditional rhythms). */
export const EXAMPLES: { id: 'walk' | 'hop' | 'echo'; steps: number[] }[] = [
  { id: 'walk', steps: [0, 2, 4, 6, 8, 10] },
  { id: 'hop', steps: [0, 1, 4, 5, 8, 9, 12] },
  { id: 'echo', steps: [0, 3, 4, 8, 11, 12] },
];

export function toggleStep(composition: Composition, step: number): Composition {
  if (!Number.isInteger(step) || step < 0 || step >= STEPS) return composition;
  if (composition.steps.includes(step)) return { ...composition, steps: composition.steps.filter((entry) => entry !== step) };
  if (composition.steps.length >= MAX_NOTES) return composition;
  return { ...composition, steps: [...composition.steps, step].sort((a, b) => a - b) };
}

export type CompositionProblem = 'empty' | 'tooFew' | 'tooMany' | 'outOfRange';
export function validateComposition(composition: Composition): CompositionProblem | null {
  const steps = composition.steps;
  if (steps.some((step) => !Number.isInteger(step) || step < 0 || step >= STEPS) || new Set(steps).size !== steps.length || !(TEMPOS as readonly number[]).includes(composition.tempo)) return 'outOfRange';
  if (steps.length === 0) return 'empty';
  if (steps.length < MIN_NOTES) return 'tooFew';
  if (steps.length > MAX_NOTES) return 'tooMany';
  return null;
}

/** Onsets in beats from the first note (the rhythm starts with its first note). */
export function onsetsOf(composition: Composition): number[] {
  const steps = [...composition.steps].sort((a, b) => a - b);
  return steps.map((step) => (step - steps[0]) * STEP_BEATS);
}
export const playbackTimes = (composition: Composition) => onsetsOf(composition).map((beat) => beat * beatMs(composition.tempo));

/**
 * compose  - the composer edits; Play / Stop / Clear / examples
 * handoff  - "pass the phone": the composition is HIDDEN from here on
 * listen   - the example plays (taps ignored)
 * ready / tapping - the player taps it back
 * feedback - timing similarity; the answer can now be shown
 */
export type WorkshopPhase = 'compose' | 'handoff' | 'listen' | 'ready' | 'tapping' | 'feedback';
export type WorkshopState = { phase: WorkshopPhase; composition: Composition; locked: Composition | null; taps: number[]; ignoredTaps: number; result: ReturnType<typeof scoreOnsets> | null; revealed: boolean };
export const START_WORKSHOP: WorkshopState = { phase: 'compose', composition: EMPTY_COMPOSITION, locked: null, taps: [], ignoredTaps: 0, result: null, revealed: false };

export type WorkshopAction =
  | { type: 'toggle'; step: number }
  | { type: 'tempo'; tempo: Tempo }
  | { type: 'clear' }
  | { type: 'example'; id: (typeof EXAMPLES)[number]['id'] }
  | { type: 'handOver' }
  | { type: 'playerReady' }
  | { type: 'demoDone' }
  | { type: 'replay' }
  | { type: 'tap'; at: number }
  | { type: 'finish' }
  | { type: 'reveal' }
  | { type: 'tryAgain' }
  | { type: 'backToCompose' }
  | { type: 'interrupt' };

function score(state: WorkshopState): WorkshopState {
  const locked = state.locked!;
  return { ...state, phase: 'feedback', result: scoreOnsets(onsetsOf(locked), locked.tempo, state.taps, state.ignoredTaps) };
}

export function workshopReducer(state: WorkshopState, action: WorkshopAction): WorkshopState {
  const composing = state.phase === 'compose';
  switch (action.type) {
    case 'toggle':
      return composing ? { ...state, composition: toggleStep(state.composition, action.step) } : state;
    case 'tempo':
      return composing && (TEMPOS as readonly number[]).includes(action.tempo) ? { ...state, composition: { ...state.composition, tempo: action.tempo } } : state;
    case 'clear':
      return composing ? { ...state, composition: { ...state.composition, steps: [] } } : state;
    case 'example': {
      const example = EXAMPLES.find((entry) => entry.id === action.id);
      return composing && example ? { ...state, composition: { ...state.composition, steps: [...example.steps] } } : state;
    }
    case 'handOver':
      // Only a valid rhythm can be handed over; from now on it is locked and hidden.
      return composing && validateComposition(state.composition) === null ? { ...state, phase: 'handoff', locked: { ...state.composition, steps: [...state.composition.steps] }, result: null, revealed: false } : state;
    case 'playerReady':
      return state.phase === 'handoff' ? { ...state, phase: 'listen', taps: [], ignoredTaps: 0 } : state;
    case 'demoDone':
      return state.phase === 'listen' ? { ...state, phase: 'ready' } : state;
    case 'replay':
      return state.phase === 'ready' || state.phase === 'tapping' ? { ...state, phase: 'listen', taps: [], ignoredTaps: 0 } : state;
    case 'tap': {
      if (!Number.isFinite(action.at) || !state.locked) return state;
      if (state.phase === 'ready') return { ...state, phase: 'tapping', taps: [action.at], ignoredTaps: 0 };
      if (state.phase !== 'tapping') return state;
      const last = state.taps[state.taps.length - 1];
      if (action.at < last) return state;
      if (action.at - last < DOUBLE_TAP_MS) return { ...state, ignoredTaps: state.ignoredTaps + 1 };
      const next = { ...state, taps: [...state.taps, action.at] };
      return next.taps.length >= state.locked.steps.length ? score(next) : next;
    }
    case 'finish':
      return state.phase === 'tapping' ? score(state) : state;
    case 'reveal':
      return state.phase === 'feedback' ? { ...state, revealed: true } : state;
    case 'tryAgain':
      return state.phase === 'feedback' ? { ...state, phase: 'handoff', taps: [], ignoredTaps: 0, result: null, revealed: false } : state;
    case 'backToCompose':
      return state.phase === 'compose' ? state : { ...state, phase: 'compose', locked: null, taps: [], ignoredTaps: 0, result: null, revealed: false };
    case 'interrupt':
      // Backgrounding / leaving: a half-done attempt is dropped; the player starts again from the hidden handoff.
      return state.phase === 'listen' || state.phase === 'ready' || state.phase === 'tapping' ? { ...state, phase: 'handoff', taps: [], ignoredTaps: 0 } : state;
  }
}

/** What the screen may show of the rhythm right now - nothing from the handoff until the answer is revealed. */
export function visibleSteps(state: WorkshopState): number[] | null {
  if (state.phase === 'compose') return state.composition.steps;
  if (state.phase === 'feedback' && state.revealed && state.locked) return state.locked.steps;
  return null;
}
