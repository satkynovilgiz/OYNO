import type { SupportedLanguage } from '@/i18n';

import type { ResolvedGlossaryEntry } from '../glossaryModel';

/**
 * Inline Kyrgyz Glossary - deterministic term matching inside Culture
 * article text.
 *
 * Source of truth: the ONE curated GLOSSARY (glossaryData.ts). Nothing is
 * extracted, inferred or generated. A term form is matchable in a language
 * only when it is an authored representation IN THAT LANGUAGE:
 *
 *   kg  the glossary term itself, the item's own Kyrgyz title (when the
 *       term IS the item) and explicit authored `aliases.kg`
 *   ru  the item's REVIEWED Russian title (term = item), `aliases.ru`
 *   en  the item's REVIEWED English title (term = item), `aliases.en`
 *
 * So a Kyrgyz term is never matched inside Russian/English text just
 * because it looks similar, and sub-terms without a reviewed RU/EN form
 * are simply not highlighted there.
 *
 * Matching is whole-word, case-insensitive (NFC + lower case), longest
 * form first, never inside a longer word (so inflected forms such as
 * "Түндүктүн" are NOT matched - no stemming, no guessing).
 */

export type TermForm = { entryId: string; form: string };

export type InlineTermIndex = {
  language: SupportedLanguage;
  /** First (normalized) character -> forms starting with it, longest first. */
  byFirstChar: ReadonlyMap<string, readonly TermForm[]>;
  size: number;
};

export type TextSegment = { kind: 'text'; text: string } | { kind: 'term'; text: string; entryId: string };

/** At most this many inline terms in one section, on top of first-occurrence-only. */
export const MAX_TERMS_PER_SECTION = 4;

const lowerChar = (ch: string): string => {
  const lower = ch.toLocaleLowerCase();
  return lower.length === ch.length ? lower : ch;
};

/** NFC + per-character lower case; keeps string length (offsets stay valid). */
export function normalizeForMatch(text: string): string {
  let out = '';
  for (const ch of text.normalize('NFC')) out += lowerChar(ch);
  return out;
}

/** Letters (any script), digits and in-word joiners count as "inside a word". */
export function isWordChar(ch: string | undefined): boolean {
  if (!ch) return false;
  if (ch.toLowerCase() !== ch.toUpperCase()) return true;
  return /[0-9\-'’ʼ]/.test(ch);
}

/** Authored forms of one entry for one rendered article language. */
export function formsFor(resolved: ResolvedGlossaryEntry, language: SupportedLanguage): string[] {
  const { entry, item } = resolved;
  const forms: string[] = [...(entry.aliases?.[language] ?? [])];
  if (language === 'kg') {
    forms.push(entry.term);
    if (entry.isItemTitle && item.translation?.titles?.kg) forms.push(item.translation.titles.kg);
  } else if (entry.isItemTitle) {
    // titles[] only holds REVIEWED translations (see localizedContent.ts).
    const reviewed = item.translation?.titles?.[language];
    if (reviewed) forms.push(reviewed);
  }
  return [...new Set(forms.map((form) => form.trim()).filter((form) => form.length >= 2))];
}

/** Build once per (glossary, language) - never per render or per paragraph. */
export function buildInlineTermIndex(resolved: readonly ResolvedGlossaryEntry[], language: SupportedLanguage): InlineTermIndex {
  const seen = new Map<string, TermForm>();
  for (const entry of resolved) {
    for (const form of formsFor(entry, language)) {
      const normalized = normalizeForMatch(form);
      // Two entries claiming the same form would be ambiguous: first wins (curated order).
      if (!seen.has(normalized)) seen.set(normalized, { entryId: entry.entry.id, form: normalized });
    }
  }
  const byFirstChar = new Map<string, TermForm[]>();
  for (const form of seen.values()) {
    const first = form.form[0];
    byFirstChar.set(first, [...(byFirstChar.get(first) ?? []), form]);
  }
  for (const list of byFirstChar.values()) list.sort((a, b) => b.form.length - a.form.length);
  return { language, byFirstChar, size: seen.size };
}

export const EMPTY_TERM_INDEX: InlineTermIndex = { language: 'kg', byFirstChar: new Map(), size: 0 };

/**
 * Split one section's text into plain and term segments. First occurrence
 * per entry only (callers pass a fresh `seen` per section), capped at
 * MAX_TERMS_PER_SECTION, and `exclude` drops entries that would point back
 * at the article being read.
 */
export function segmentText(text: string, index: InlineTermIndex, options: { exclude?: ReadonlySet<string>; seen?: Set<string>; max?: number } = {}): TextSegment[] {
  if (!text || index.size === 0) return [{ kind: 'text', text }];
  const source = text.normalize('NFC');
  const lower = normalizeForMatch(source);
  const seen = options.seen ?? new Set<string>();
  const max = options.max ?? MAX_TERMS_PER_SECTION;
  const segments: TextSegment[] = [];
  let plainStart = 0;
  let found = 0;
  for (let i = 0; i < lower.length && found < max; i += 1) {
    if (isWordChar(source[i - 1])) continue;
    const candidates = index.byFirstChar.get(lower[i]);
    if (!candidates) continue;
    const match = candidates.find(({ form, entryId }) => !seen.has(entryId) && !options.exclude?.has(entryId) && lower.startsWith(form, i) && !isWordChar(source[i + form.length]));
    if (!match) continue;
    if (i > plainStart) segments.push({ kind: 'text', text: source.slice(plainStart, i) });
    segments.push({ kind: 'term', text: source.slice(i, i + match.form.length), entryId: match.entryId });
    seen.add(match.entryId);
    found += 1;
    plainStart = i + match.form.length;
    i = plainStart - 1;
  }
  if (plainStart < source.length) segments.push({ kind: 'text', text: source.slice(plainStart) });
  return segments;
}

/** Entries never linked inside their own source article. */
export function selfEntryIds(resolved: readonly ResolvedGlossaryEntry[], articleItemId: string | null): Set<string> {
  return new Set(articleItemId ? resolved.filter(({ entry }) => entry.sourceContentId === articleItemId).map(({ entry }) => entry.id) : []);
}

export type InlineDefinition = { term: string; text: string; showImage: boolean; large: boolean };

/**
 * What the quick-lookup sheet shows, per age experience - always the
 * EXISTING authored text, only shortened visually (never reworded):
 *   child    the item's authored simple summary when there is one, else
 *            the definition; short; larger sheet with the image
 *   preteen  definition, medium length, with the image (visual)
 *   teen / adult  compact text only
 */
export function inlineDefinition(resolved: ResolvedGlossaryEntry, experience: 'child' | 'preteen' | 'teen' | 'adult', simpleSummary: string | null): InlineDefinition {
  const shorten = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`);
  if (experience === 'child') return { term: resolved.entry.term, text: shorten(resolved.entry.isItemTitle && simpleSummary ? simpleSummary : resolved.definition, 120), showImage: true, large: true };
  if (experience === 'preteen') return { term: resolved.entry.term, text: shorten(resolved.definition, 180), showImage: true, large: false };
  return { term: resolved.entry.term, text: shorten(resolved.definition, 260), showImage: false, large: false };
}
