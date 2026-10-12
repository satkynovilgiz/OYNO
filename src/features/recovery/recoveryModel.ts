import type { EditorDraft } from '@/features/journal/editor/editorDraft';
import type { Portfolio } from '@/features/culture/oymo/portfolio/portfolioModel';
import type { Scrapbook } from '@/features/scrapbook/scrapbookModel';
import { entriesFor } from '@/services/drafts/draftRegistry';

/**
 * Recovery Center - lists the CURRENT owner's unfinished work from the
 * editors' own draft sources (nothing copied):
 *  - in-memory unsaved edits: portfolios, scrapbooks, questions (new and
 *    edits), Listening Compare notes - these end when the app is closed;
 *  - Journal editor drafts - stored on the device, survive a restart;
 *  - a pending operation: a first-use design that was saved but whose
 *    guide step wasn't recorded.
 * Retry is offered only where repeating is safe (an update of an existing
 * record, or recording a step) - never for anything that would CREATE a
 * record (a new question, a new journal memory, a deleted parent).
 */
export type RecoveryKind = 'portfolio' | 'scrapbook' | 'questionNew' | 'questionEdit' | 'compareNote' | 'explanation' | 'journal' | 'firstUse';
export type ParentState = 'ok' | 'missing' | 'loading' | 'none';
export type RecoveryEntry = {
  id: string;
  kind: RecoveryKind;
  /** 'unsaved' = edits not saved; 'pending' = saved, one step still to do. */
  state: 'unsaved' | 'pending';
  survivesRestart: boolean;
  title: string;
  parent: ParentState;
  route: string;
  retry: boolean;
};

export type RecoveryInputs = {
  owner: string;
  portfolioExists: (id: string) => boolean | undefined;
  scrapbookExists: (id: string) => boolean | undefined;
  question: (id: string) => { text: string } | null | undefined;
  comparison: (id: string) => { a: string; b: string } | null | undefined;
  journalDrafts: readonly EditorDraft[];
  journalEntryExists: (id: string) => boolean | undefined;
  firstUse: { savedName: string } | null;
};

const parentOf = (exists: boolean | undefined): ParentState => (exists === undefined ? 'loading' : exists ? 'ok' : 'missing');

export function listRecovery(input: RecoveryInputs): RecoveryEntry[] {
  const out: RecoveryEntry[] = [];
  for (const { rest, value } of entriesFor<Portfolio>('portfolio', input.owner)) {
    const parent = parentOf(input.portfolioExists(rest));
    out.push({ id: `portfolio:${rest}`, kind: 'portfolio', state: 'unsaved', survivesRestart: false, title: value.title, parent, route: `/profile/oymo-portfolios/${encodeURIComponent(rest)}`, retry: parent === 'ok' });
  }
  for (const { rest, value } of entriesFor<Scrapbook>('scrapbook', input.owner)) {
    const parent = parentOf(input.scrapbookExists(rest));
    out.push({ id: `scrapbook:${rest}`, kind: 'scrapbook', state: 'unsaved', survivesRestart: false, title: value.title, parent, route: `/profile/scrapbooks/${encodeURIComponent(rest)}`, retry: parent === 'ok' });
  }
  const editedQuestions = new Set<string>();
  for (const { rest, value } of entriesFor<string>('question', input.owner)) {
    const [scope, ...parts] = rest.split(':');
    if (scope === 'origin') {
      const [articleId, sectionKey] = parts;
      // A NEW question: saving creates a record - opened in its section, never retried from here.
      out.push({ id: `questionNew:${articleId}:${sectionKey}`, kind: 'questionNew', state: 'unsaved', survivesRestart: false, title: value, parent: 'none', route: `/culture/item/${encodeURIComponent(articleId)}?section=${encodeURIComponent(sectionKey)}`, retry: false });
    } else if ((scope === 'text' || scope === 'answer') && parts[0] && !editedQuestions.has(parts[0])) {
      editedQuestions.add(parts[0]);
      const found = input.question(parts[0]);
      const parent = found === undefined ? 'loading' : found ? 'ok' : 'missing';
      out.push({ id: `questionEdit:${parts[0]}`, kind: 'questionEdit', state: 'unsaved', survivesRestart: false, title: found?.text ?? value, parent, route: `/profile/questions/${encodeURIComponent(parts[0])}`, retry: parent === 'ok' });
    }
  }
  for (const { rest, value } of entriesFor<string>('compareNote', input.owner)) {
    const found = input.comparison(rest);
    const parent = found === undefined ? 'loading' : found ? 'ok' : 'missing';
    out.push({ id: `compareNote:${rest}`, kind: 'compareNote', state: 'unsaved', survivesRestart: false, title: found ? `${found.a} · ${found.b}` : value.slice(0, 60), parent, route: `/culture/komuz/compare/${encodeURIComponent(rest)}`, retry: parent === 'ok' });
  }
  // An explanation saves as an update keyed by its article, so retrying can't make a duplicate.
  for (const { rest, value } of entriesFor<{ text: string; titleSnapshot: string }>('explanation', input.owner)) {
    out.push({ id: `explanation:${rest}`, kind: 'explanation', state: 'unsaved', survivesRestart: false, title: value.titleSnapshot || value.text.slice(0, 60), parent: 'none', route: `/culture/item/${encodeURIComponent(rest)}/explain`, retry: value.text.trim().length > 0 });
  }
  for (const draft of input.journalDrafts) {
    const isNew = draft.target === 'new';
    const parent: ParentState = isNew ? 'none' : parentOf(input.journalEntryExists(draft.target));
    out.push({ id: `journal:${draft.target}`, kind: 'journal', state: 'unsaved', survivesRestart: true, title: draft.fields.title || draft.fields.note.slice(0, 60), parent, route: isNew ? '/journal/new' : `/journal/${encodeURIComponent(draft.target)}`, retry: false });
  }
  if (input.firstUse) out.push({ id: 'firstUse', kind: 'firstUse', state: 'pending', survivesRestart: false, title: input.firstUse.savedName, parent: 'none', route: '/start', retry: true });
  return out;
}
