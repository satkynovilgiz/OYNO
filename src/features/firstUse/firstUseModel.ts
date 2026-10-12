import { type OymoEditorState, type SymmetryMode } from '@/services/culture/oymoEditor';

/**
 * The first-use guide ("Help me get started"), offered once after
 * onboarding: discover ONE article -> make a small Oymo design with guidance
 * -> choose whether to save it -> find it on My OYNO Shelf. Optional and
 * skippable at any point; replayable from Help. It records only which steps
 * were done - no scores, levels or claims of mastery.
 */
export type FirstUseStep = 'article' | 'create' | 'save' | 'find';
export const FIRST_USE_STEPS: FirstUseStep[] = ['article', 'create', 'save', 'find'];
/** The suggested first article (falls back to the first available one). */
export const FIRST_ARTICLE_ID = 'boz-uy-overview';

export type FirstUseRecord = {
  /** offered = onboarding just finished and Home shows the offer; nothing started yet. */
  status: 'offered' | 'active' | 'skipped' | 'finished';
  /** ISO time each step was done; `save` also says what was chosen. */
  done: Partial<Record<FirstUseStep, string>>;
  saveChoice: 'saved' | 'not_saved' | null;
  savedName: string | null;
};
export const NEW_RECORD: FirstUseRecord = { status: 'active', done: {}, saveChoice: null, savedName: null };

/** The first step not done yet (null = all done). */
export const currentStep = (record: FirstUseRecord): FirstUseStep | null => FIRST_USE_STEPS.find((step) => !record.done[step]) ?? null;
/** Home shows the offer once onboarding marked it (never to existing users unprompted), and "Continue" while active. */
export const homeCard = (record: FirstUseRecord | null): 'offer' | 'continue' | null => (record?.status === 'offered' ? 'offer' : record?.status === 'active' ? 'continue' : null);

export function markDone(record: FirstUseRecord, step: FirstUseStep, at: string, extra: Partial<Pick<FirstUseRecord, 'saveChoice' | 'savedName'>> = {}): FirstUseRecord {
  if (record.status !== 'active' || currentStep(record) !== step) return record;
  const done = { ...record.done, [step]: at };
  const next = { ...record, ...extra, done };
  return currentStep(next) === null ? { ...next, status: 'finished' } : next;
}

export function pickArticle(available: readonly string[]): string | null {
  return available.includes(FIRST_ARTICLE_ID) ? FIRST_ARTICLE_ID : (available[0] ?? null);
}

export function normalizeRecord(raw: unknown): FirstUseRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<FirstUseRecord>;
  if (value.status !== 'offered' && value.status !== 'active' && value.status !== 'skipped' && value.status !== 'finished') return null;
  const done: FirstUseRecord['done'] = {};
  for (const step of FIRST_USE_STEPS) {
    const at = (value.done as Record<string, unknown> | undefined)?.[step];
    if (typeof at === 'string') done[step] = at;
  }
  const saveChoice = value.saveChoice === 'saved' || value.saveChoice === 'not_saved' ? value.saveChoice : null;
  const savedName = typeof value.savedName === 'string' ? value.savedName.slice(0, 60) : null;
  return { status: value.status, done, saveChoice, savedName };
}

/* ---------- the unsaved design (memory only), bound to its owner ---------- */

export type FirstUseDraft = {
  owner: string;
  state: OymoEditorState;
  symmetry: SymmetryMode;
  name: string;
  /** The guest chose "Sign in to save": the design waits for the account. */
  awaitingAuth: boolean;
};
let draft: FirstUseDraft | null = null;
export const keepDraft = (next: FirstUseDraft | null) => {
  draft = next;
};
export const peekDraft = () => draft;
export const hasAwaitingDraft = () => !!draft?.awaitingAuth;

/**
 * The draft for this owner. A guest's design waiting for sign-in is handed to
 * the account that signs in (once); any other owner change drops it - one
 * account never sees another's unsaved design.
 */
export function draftFor(owner: string): { draft: FirstUseDraft | null; adoptedFrom: string | null } {
  if (!draft) return { draft: null, adoptedFrom: null };
  if (draft.owner === owner) return { draft, adoptedFrom: null };
  if (draft.awaitingAuth && draft.owner === 'guest' && owner !== 'guest') {
    const from = draft.owner;
    draft = { ...draft, owner, awaitingAuth: false };
    return { draft, adoptedFrom: from };
  }
  draft = null;
  return { draft: null, adoptedFrom: null };
}

/**
 * The save step. "Saved" is reported (and the step recorded) only after the
 * save itself succeeded; on failure the draft is kept and nothing is marked.
 */
export async function saveGuideDesign(deps: { save: () => Promise<boolean>; markSaved: () => Promise<boolean> }): Promise<'saved' | 'saved_unrecorded' | 'failed'> {
  if (!(await deps.save())) return 'failed';
  keepDraft(null);
  return (await deps.markSaved()) ? 'saved' : 'saved_unrecorded';
}
