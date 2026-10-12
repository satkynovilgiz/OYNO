import { CULTURE_CONNECTIONS, type CultureConnection } from '@/features/culture/connections/connectionsData';
import { normalizeVerification, type VerificationLevel } from '@/services/content/verification';

import { explorerSources, type ExplorerSource } from './sourceExplorer';

/**
 * Source Lens - "About this information" for ONE article section, built
 * only from metadata OYNO actually stores:
 *  - the article's recorded sources + its review state (article-level: OYNO
 *    keeps NO source-to-section mapping, and says so);
 *  - the article's own authored-text date, when stored;
 *  - exact excerpts of THIS section that connections quote (original words,
 *    kept apart from OYNO's summaries);
 *  - contributor quotations: none are stored in OYNO's content today.
 * The reader's own bookmark note / highlight notes are listed separately as
 * personal notes - never as evidence. Nothing is invented: no authors,
 * dates, references or confidence scores.
 */
export type LensArticle = { id: string; sources: readonly string[] | null; accuracy_level: string | null; content_updated_at?: string | null };
export type PersonalNote = { kind: 'bookmark' | 'highlight'; note: string };
export type SourceLens = {
  sectionKey: string;
  sources: ExplorerSource[];
  /** At least one openable, recorded source exists for the article. */
  hasAttribution: boolean;
  level: VerificationLevel;
  textUpdatedAt: string | null;
  sectionMapping: false;
  excerpts: { connectionId: string; evidence: string }[];
  contributorQuotes: [];
  personal: PersonalNote[];
};

const validDate = (value: string | null | undefined) => (typeof value === 'string' && !Number.isNaN(Date.parse(value)) && Date.parse(value) > 0 ? value : null);

export function buildSourceLens(article: LensArticle, sectionKey: string, personal: readonly PersonalNote[], connections: readonly CultureConnection[] = CULTURE_CONNECTIONS): SourceLens {
  const sources = explorerSources(article.sources);
  return {
    sectionKey,
    sources,
    hasAttribution: sources.some((source) => source.kind === 'link'),
    level: normalizeVerification(article.accuracy_level),
    textUpdatedAt: validDate(article.content_updated_at),
    sectionMapping: false,
    excerpts: connections.filter((c) => c.source.contentType === 'culture_item' && c.source.contentId === article.id && c.source.field === sectionKey).map((c) => ({ connectionId: c.id, evidence: c.evidence })),
    contributorQuotes: [],
    // Only notes the reader actually wrote; empty notes aren't listed.
    personal: personal.filter((entry) => entry.note.trim()).map((entry) => ({ kind: entry.kind, note: entry.note.trim() })),
  };
}

/** The URL exactly as recorded (http/https only) - nothing appended: no notes, no account, no tracking. */
export const lensLink = (source: ExplorerSource): string | null => (source.kind === 'link' ? source.info.url : null);

/* ---------- which section's lens is open (memory, per article) - survives opening a source ---------- */
const open = new Map<string, string>();
export const keepOpenLens = (articleId: string, sectionKey: string | null) => (sectionKey ? open.set(articleId, sectionKey) : open.delete(articleId));
export const openLensFor = (articleId: string) => open.get(articleId) ?? null;

/** The article's scroll offset when it was left from an open lens - restored ONCE on return. */
const returns = new Map<string, number>();
export const keepLensReturn = (articleId: string, y: number) => {
  if (Number.isFinite(y) && y > 0) returns.set(articleId, y);
};
export function takeLensReturn(articleId: string): number | null {
  const y = returns.get(articleId);
  returns.delete(articleId);
  return y ?? null;
}
