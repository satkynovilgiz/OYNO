import { BOZ_UY_STEPS, type BozUyStepId } from '@/services/culture/bozUySteps';

/**
 * Build from Memory - rebuild the guided builder's AUTHORED assembly
 * sequence (BOZ_UY_STEPS, in construction order). Nothing new is claimed:
 * a wrong choice is explained with that part's own authored tip, a hint is
 * the next step's authored tip. Untimed. Results are practice performance
 * only - no XP, no achievement, no global score.
 *
 *  practice   choices show each part's description; hints any time
 *  challenge  choices show names only; hints still available, and noted
 */
export type MemoryMode = 'practice' | 'challenge';
export type Rng = () => number;

export type MemoryAttempt = {
  mode: MemoryMode;
  /** Parts placed so far, in order (always a correct prefix of BOZ_UY_STEPS). */
  placed: BozUyStepId[];
  /** Wrong picks per step index. */
  wrong: Record<number, BozUyStepId[]>;
  /** Step indexes for which a hint was shown. */
  hinted: number[];
  /** The last wrong pick, explained until the next action. */
  lastWrong: BozUyStepId | null;
  /** Order the remaining parts are offered in (shuffled once per attempt). */
  order: BozUyStepId[];
};

export const ORDER: BozUyStepId[] = BOZ_UY_STEPS.map((step) => step.id);

function shuffled(rng: Rng): BozUyStepId[] {
  const out = [...ORDER];
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [out[index], out[swap]] = [out[swap], out[index]];
  }
  // Never offer the parts already in the right order - that would give the answer away.
  if (out.every((id, index) => id === ORDER[index])) out.push(out.shift()!);
  return out;
}

export function startAttempt(mode: MemoryMode, rng: Rng = Math.random): MemoryAttempt {
  return { mode, placed: [], wrong: {}, hinted: [], lastWrong: null, order: shuffled(rng) };
}

export const isComplete = (attempt: MemoryAttempt) => attempt.placed.length === ORDER.length;
export const nextIndex = (attempt: MemoryAttempt) => attempt.placed.length;
/** The parts still to place, in this attempt's offer order (a small set: at most four). */
export const choicesFor = (attempt: MemoryAttempt) => attempt.order.filter((id) => !attempt.placed.includes(id));

export type MemoryAction = { type: 'choose'; part: BozUyStepId } | { type: 'hint' } | { type: 'restart'; rng?: Rng };

export function memoryReducer(attempt: MemoryAttempt, action: MemoryAction): MemoryAttempt {
  if (action.type === 'restart') return startAttempt(attempt.mode, action.rng);
  if (isComplete(attempt)) return attempt;
  const index = nextIndex(attempt);
  switch (action.type) {
    case 'choose': {
      if (!choicesFor(attempt).includes(action.part)) return attempt;
      if (action.part === ORDER[index]) return { ...attempt, placed: [...attempt.placed, action.part], lastWrong: null };
      const wrong = attempt.wrong[index] ?? [];
      return { ...attempt, wrong: wrong.includes(action.part) ? attempt.wrong : { ...attempt.wrong, [index]: [...wrong, action.part] }, lastWrong: action.part };
    }
    case 'hint':
      return attempt.hinted.includes(index) ? attempt : { ...attempt, hinted: [...attempt.hinted, index] };
  }
}

export type ReviewRow = { index: number; part: BozUyStepId; wrongTries: BozUyStepId[]; hinted: boolean };
/** The final reconstruction, step by step, with what each step needed. */
export function review(attempt: MemoryAttempt): ReviewRow[] {
  return attempt.placed.map((part, index) => ({ index, part, wrongTries: attempt.wrong[index] ?? [], hinted: attempt.hinted.includes(index) }));
}
export function summary(attempt: MemoryAttempt): { firstTry: number; hints: number; total: number } {
  const rows = review(attempt);
  return { firstTry: rows.filter((row) => row.wrongTries.length === 0 && !row.hinted).length, hints: attempt.hinted.length, total: ORDER.length };
}

/**
 * An attempt in progress survives the screen being re-created (e.g. after
 * opening the source article) - in MEMORY only, one slot.
 */
let kept: MemoryAttempt | null = null;
export const keepAttempt = (attempt: MemoryAttempt | null) => {
  kept = attempt;
};
export const resumeAttempt = () => kept;
