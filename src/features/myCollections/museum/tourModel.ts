import type { Exhibition, ExhibitKey, ExhibitSlide, ReflectionPromptId } from './museumModel';

/**
 * Mini Museum - guided visitor mode. Pure: a welcome, the exhibits in the
 * CURATOR's order, an optional reflection prompt after the exhibits the
 * curator chose, and a closing summary. Nothing advances on its own.
 *
 * Nothing here is learning progress: what was viewed and what a visitor
 * typed live only in this tour's state and are gone when it ends - never
 * stored, synced or counted as completion.
 */
export const RESPONSE_MAX = 500;

/** An exhibit whose content can't be shown: removed from OYNO, or not on the device while offline. */
export type TourExhibit = ExhibitSlide | { kind: 'offline'; key: ExhibitKey; caption: string | null; contentType: string };

export type TourStep =
  | { kind: 'welcome' }
  | { kind: 'exhibit'; position: number; exhibit: TourExhibit }
  | { kind: 'reflection'; position: number; key: ExhibitKey; prompt: ReflectionPromptId }
  | { kind: 'closing' };

/** While offline, content that isn't resolvable is "not on this device", not "removed". */
export function tourExhibits(slides: readonly ExhibitSlide[], isOffline: boolean): TourExhibit[] {
  return slides.map((slide) => (slide.kind === 'removed' && isOffline ? { kind: 'offline', key: slide.key, caption: slide.caption, contentType: slide.contentType } : slide));
}

export function buildTour(exhibition: Pick<Exhibition, 'exhibits' | 'reflections'>, exhibits: readonly TourExhibit[]): TourStep[] {
  const steps: TourStep[] = [{ kind: 'welcome' }];
  exhibits.forEach((exhibit, position) => {
    steps.push({ kind: 'exhibit', position, exhibit });
    const prompt = exhibition.reflections?.[exhibit.key];
    // A reflection only follows an exhibit the visitor could actually see.
    if (prompt && exhibit.kind === 'exhibit') steps.push({ kind: 'reflection', position, key: exhibit.key, prompt });
  });
  steps.push({ kind: 'closing' });
  return steps;
}

/**
 * The current step is held by IDENTITY (step type + exhibit key), not by
 * position: steps are rebuilt as content loads or the network changes (a
 * reflection can appear once its exhibit resolves), and the visitor must
 * stay on the step they are looking at.
 */
export type StepId = 'welcome' | 'closing' | `exhibit:${ExhibitKey}` | `reflection:${ExhibitKey}`;
export const stepId = (step: TourStep): StepId => (step.kind === 'exhibit' ? `exhibit:${step.exhibit.key}` : step.kind === 'reflection' ? `reflection:${step.key}` : step.kind);

/** `lastIndex` is only a fallback hint for when the current step no longer exists. */
export type TourState = { current: StepId; lastIndex: number; viewed: ExhibitKey[]; responses: Record<ExhibitKey, string> };
export const START_TOUR: TourState = { current: 'welcome', lastIndex: 0, viewed: [], responses: {} };

/**
 * Where the visitor is in THESE steps. If their step is gone:
 *  - a reflection that disappeared -> its own exhibit;
 *  - otherwise -> the step now at the position they were at (clamped),
 *    i.e. what moved into its place - never a jump back to the start.
 */
export function currentIndex(steps: readonly TourStep[], state: TourState): number {
  const found = steps.findIndex((step) => stepId(step) === state.current);
  if (found >= 0) return found;
  if (state.current.startsWith('reflection:')) {
    const own = steps.findIndex((step) => stepId(step) === `exhibit:${state.current.slice('reflection:'.length)}`);
    if (own >= 0) return own;
  }
  return Math.max(0, Math.min(state.lastIndex, steps.length - 1));
}

/** The visitor really saw this exhibit: its content is on screen (never loading, removed or offline). */
const seen = (state: TourState, step: TourStep | undefined) =>
  step?.kind === 'exhibit' && step.exhibit.kind === 'exhibit' && !state.viewed.includes(step.exhibit.key) ? [...state.viewed, step.exhibit.key] : state.viewed;

function enter(state: TourState, steps: readonly TourStep[], index: number): TourState {
  if (index < 0 || index >= steps.length || index === currentIndex(steps, state)) return state;
  return { ...state, current: stepId(steps[index]), lastIndex: index, viewed: seen(state, steps[index]) };
}

export type TourAction = { type: 'next' } | { type: 'previous' } | { type: 'goTo'; index: number } | { type: 'respond'; key: ExhibitKey; text: string } | { type: 'restart' } | { type: 'sync' };

/**
 * Every move is the visitor's: Next (also skips a reflection), Previous, or
 * a jump back to an earlier step. `sync` (after the steps were rebuilt)
 * pins the current identity to where it now resolves and records a view
 * only if the visitor is now actually looking at loaded content.
 */
export function tourReducer(steps: readonly TourStep[], state: TourState, action: TourAction): TourState {
  const index = currentIndex(steps, state);
  switch (action.type) {
    case 'next':
      return enter(state, steps, index + 1);
    case 'previous':
      return enter(state, steps, index - 1);
    case 'goTo':
      return Number.isInteger(action.index) ? enter(state, steps, action.index) : state;
    case 'respond': {
      const step = steps[index];
      if (step?.kind !== 'reflection' || step.key !== action.key) return state;
      return { ...state, responses: { ...state.responses, [action.key]: action.text.slice(0, RESPONSE_MAX) } };
    }
    case 'sync': {
      const current = stepId(steps[index]);
      const viewed = seen(state, steps[index]);
      if (current === state.current && index === state.lastIndex && viewed === state.viewed) return state;
      return { ...state, current, lastIndex: index, viewed };
    }
    case 'restart':
      return START_TOUR;
  }
}

/** The exhibit steps, for "Exhibit n of N" and the step list. */
export const exhibitSteps = (steps: readonly TourStep[]) => steps.flatMap((step, index) => (step.kind === 'exhibit' ? [{ index, step }] : []));

export type ClosingRow = { key: ExhibitKey; position: number; status: TourExhibit['kind']; viewed: boolean; title: string | null; route: string | null; stepIndex: number };

/** The closing screen: every exhibit in the curator's order, whether it was viewed, and its source link. */
export function closingRows(steps: readonly TourStep[], state: TourState): ClosingRow[] {
  return exhibitSteps(steps).map(({ index, step }) => {
    const exhibit = (step as Extract<TourStep, { kind: 'exhibit' }>).exhibit;
    const content = exhibit.kind === 'exhibit' ? exhibit.content : null;
    return { key: exhibit.key, position: (step as Extract<TourStep, { kind: 'exhibit' }>).position, status: exhibit.kind, viewed: state.viewed.includes(exhibit.key), title: content?.title ?? null, route: content?.route ?? null, stepIndex: index };
  });
}
