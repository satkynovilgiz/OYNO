import type { Portfolio } from '@/features/culture/oymo/portfolio/portfolioModel';
import type { ExplainDraft } from '@/features/explain/explainModel';
import { clearUnrecordedSave, retryRecording, unrecordedSave } from '@/features/firstUse/firstUseModel';
import type { Scrapbook } from '@/features/scrapbook/scrapbookModel';
import { draftMap, ownerKey } from '@/services/drafts/draftRegistry';
import { useExplanationsStore } from '@/store/useExplanationsStore';
import { useFirstUseStore } from '@/store/useFirstUseStore';
import { useJournalDraftStore } from '@/store/useJournalDraftStore';
import { useListeningCompareStore } from '@/store/useListeningCompareStore';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { useQuestionsStore } from '@/store/useQuestionsStore';
import { useScrapbookStore } from '@/store/useScrapbookStore';

import type { RecoveryEntry } from './recoveryModel';

/** Clears `key` only if it still holds exactly what was sent - newer edits stay. */
function clearIfUnchanged<T>(map: Map<string, T>, key: string, sent: T) {
  if (map.get(key) === sent) map.delete(key);
}

/**
 * Retry - ONLY for safe operations (entry.retry): an update of a record
 * that exists, or recording a step. Never creates a record. Sends the
 * draft as it is NOW; edits made during the retry are kept.
 */
export async function retryEntry(owner: string, entry: RecoveryEntry): Promise<boolean> {
  if (!entry.retry) return false;
  const rest = entry.id.slice(entry.id.indexOf(':') + 1);
  switch (entry.kind) {
    case 'portfolio': {
      const map = draftMap<Portfolio>('portfolio');
      const key = ownerKey(owner, rest);
      const sent = map.get(key);
      if (!sent || !(await usePortfolioStore.getState().save(owner, sent))) return false;
      clearIfUnchanged(map, key, sent);
      return true;
    }
    case 'scrapbook': {
      const map = draftMap<Scrapbook>('scrapbook');
      const key = ownerKey(owner, rest);
      const sent = map.get(key);
      if (!sent || !(await useScrapbookStore.getState().save(owner, sent))) return false;
      clearIfUnchanged(map, key, sent);
      return true;
    }
    case 'questionEdit': {
      const map = draftMap<string>('question');
      const textKey = ownerKey(owner, `text:${rest}`);
      const answerKey = ownerKey(owner, `answer:${rest}`);
      const text = map.get(textKey);
      const answer = map.get(answerKey);
      const changes = [...(text !== undefined ? [{ type: 'text' as const, text }] : []), ...(answer !== undefined ? [{ type: 'answer' as const, answer }] : [])];
      if (!(await useQuestionsStore.getState().change(owner, rest, changes))) return false;
      if (text !== undefined) clearIfUnchanged(map, textKey, text);
      if (answer !== undefined) clearIfUnchanged(map, answerKey, answer);
      return true;
    }
    case 'compareNote': {
      const map = draftMap<string>('compareNote');
      const key = ownerKey(owner, rest);
      const sent = map.get(key);
      if (sent === undefined || !(await useListeningCompareStore.getState().saveNote(owner, rest, sent))) return false;
      clearIfUnchanged(map, key, sent);
      return true;
    }
    case 'explanation': {
      const map = draftMap<ExplainDraft>('explanation');
      const key = ownerKey(owner, rest);
      const sent = map.get(key);
      if (!sent || !(await useExplanationsStore.getState().save(owner, { articleId: rest, titleSnapshot: sent.titleSnapshot, promptId: sent.promptId, text: sent.text }))) return false;
      clearIfUnchanged(map, key, sent);
      return true;
    }
    case 'firstUse': {
      const pending = unrecordedSave(owner);
      if (!pending) return false;
      return retryRecording(owner, () => useFirstUseStore.getState().done(owner, 'save', { saveChoice: 'saved', savedName: pending.savedName }));
    }
    default:
      return false;
  }
}

/** Discards ONE draft (after the screen's confirmation). Saved records are never touched. */
export async function discardEntry(owner: string, entry: RecoveryEntry): Promise<void> {
  const rest = entry.id.slice(entry.id.indexOf(':') + 1);
  switch (entry.kind) {
    case 'portfolio':
      draftMap('portfolio').delete(ownerKey(owner, rest));
      return;
    case 'scrapbook':
      draftMap('scrapbook').delete(ownerKey(owner, rest));
      return;
    case 'questionNew':
      draftMap('question').delete(ownerKey(owner, `origin:${rest}`));
      return;
    case 'questionEdit':
      draftMap('question').delete(ownerKey(owner, `text:${rest}`));
      draftMap('question').delete(ownerKey(owner, `answer:${rest}`));
      return;
    case 'compareNote':
      draftMap('compareNote').delete(ownerKey(owner, rest));
      return;
    case 'explanation':
      draftMap('explanation').delete(ownerKey(owner, rest));
      return;
    case 'journal':
      await useJournalDraftStore.getState().remove(owner, rest);
      return;
    case 'firstUse':
      // The design stays saved; only the reminder to record the guide step goes.
      if (unrecordedSave(owner)) clearUnrecordedSave();
      return;
  }
}
