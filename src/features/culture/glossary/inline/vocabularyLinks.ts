import { recordedAudioFor } from '@/services/audioGuide/contentAudio';

import type { GlossaryStudyRecord } from '../study/glossaryStudy';
import { normalizeForMatch } from './inlineTermIndex';

/**
 * Contextual vocabulary - a small REVIEWED mapping of glossary entries to
 * the article sections where they appear (stable section keys). In those
 * sections the existing inline glossary link opens the quick sheet with:
 *  - the existing definition (unchanged),
 *  - an EXAMPLE: the sentence of this very section that contains the term,
 *    quoted from the authored text (or its reviewed translation), with its
 *    source - never a written-for-the-app sentence,
 *  - pronunciation ONLY from a verified recording (none exist yet: the
 *    sheet says so; device speech is not presented as pronunciation),
 *  - "Add to my review": the existing Glossary study queue.
 * Each pair was checked against the seeded article text (vocabulary.test.ts).
 */
export type VocabLink = { glossaryId: string; articleId: string; sectionKey: string };

export const VOCAB_LINKS: readonly VocabLink[] = [
  { glossaryId: 'tunduk', articleId: 'boz-uy-overview', sectionKey: 'objects_used' },
  { glossaryId: 'uuk', articleId: 'boz-uy-overview', sectionKey: 'objects_used' },
  { glossaryId: 'tunduk', articleId: 'boz-uy-karkas', sectionKey: 'objects_used' },
  { glossaryId: 'shyrdak', articleId: 'boz-uy-ichki-jasalga', sectionKey: 'objects_used' },
  { glossaryId: 'ala-kiyiz', articleId: 'boz-uy-ichki-jasalga', sectionKey: 'objects_used' },
];

export const vocabLinkFor = (articleId: string | null, sectionKey: string | null | undefined, glossaryId: string): VocabLink | null =>
  articleId && sectionKey ? (VOCAB_LINKS.find((link) => link.articleId === articleId && link.sectionKey === sectionKey && link.glossaryId === glossaryId) ?? null) : null;

/**
 * The sentence of `sectionText` that contains `form` (the exact word that was
 * tapped), as written - trimmed, nothing added. Null when it isn't found.
 */
export function exampleSentence(sectionText: string, form: string): string | null {
  if (!sectionText || !form) return null;
  const sentences = sectionText.normalize('NFC').split(/(?<=[.!?…])\s+|\n+/).map((part) => part.trim()).filter(Boolean);
  const needle = normalizeForMatch(form);
  return sentences.find((sentence) => normalizeForMatch(sentence).includes(needle)) ?? null;
}

/** Pronunciation only from a verified recording of the term (content key `glossary:<id>`, Kyrgyz). */
export const verifiedPronunciation = (glossaryId: string) => recordedAudioFor(`glossary:${glossaryId}`, 'kg');

/** "In my review list" = the existing study record says it needs review. */
export const inReview = (record: GlossaryStudyRecord | undefined) => !!record?.needsReview;
