import type { SupportedLanguage } from '@/i18n';
import { resolveContentByDepth } from '@/services/ageExperience/contentDepth';
import type { ContentDepth } from '@/services/ageExperience/types';
import { CULTURE_ITEM_DETAIL_FIELDS, localizedSimpleSummary } from '@/services/audioGuide/contentNarration';
import { joinNarration, splitIntoChunks } from '@/services/audioGuide/narration';
import type { CultureItemRow, CultureMaterialRow } from '@/services/content/types';

/**
 * Read & Listen - which AUTHORED section is being read aloud right now.
 *
 * Device speech already reads the narration in known chunks (the store's
 * `chunk`). The narration text is built from the same sections the screen
 * shows (contentNarration.ts), so each chunk can be mapped back to the
 * section(s) it covers - exactly, by character offsets. Recorded audio has
 * no authored timestamps in OYNO, so it never highlights anything (no
 * guessed sync). No word-level karaoke.
 */

export type NarrationPart = { key: string; text: string };

/** Mirrors cultureItemNarration(): same parts, same order, same language rule. */
export function cultureItemNarrationParts(item: CultureItemRow, appLanguage: SupportedLanguage, depth: ContentDepth): NarrationPart[] {
  const simpleSummary = resolveContentByDepth({ simple: localizedSimpleSummary(item, appLanguage) }, depth);
  if (simpleSummary) return [{ key: 'title', text: item.title }, { key: 'simple_summary', text: simpleSummary }];
  const bodyLanguage: SupportedLanguage = item.translation?.status === 'available' ? appLanguage : 'kg';
  const title = bodyLanguage === 'kg' ? (item.translation?.titles.kg ?? item.title) : item.title;
  return [{ key: 'title', text: title }, ...CULTURE_ITEM_DETAIL_FIELDS.filter((key) => !!item[key]).map((key) => ({ key: key as string, text: item[key] as string }))];
}

/** Mirrors materialNarration(). */
export function materialNarrationParts(material: CultureMaterialRow, appLanguage: SupportedLanguage): NarrationPart[] {
  if (!material.body) return [];
  const bodyLanguage: SupportedLanguage = appLanguage !== 'kg' && material.translation?.status === 'available' ? appLanguage : 'kg';
  return [{ key: 'title', text: bodyLanguage === 'kg' ? (material.translation?.titles.kg ?? material.title) : material.title }, { key: 'body', text: material.body }];
}

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * chunk index -> section keys it overlaps (usually one; two when a chunk
 * spans a boundary). Built from the SAME join + split the player uses; if
 * the texts ever disagree the map is empty (no highlight rather than a
 * wrong one).
 */
export function chunkSectionMap(parts: readonly NarrationPart[], chunks: readonly string[]): string[][] {
  const kept = parts.filter((part) => part.text?.trim());
  const pieces = kept.map((part) => normalize(joinNarration([part.text])));
  const joined = pieces.join(' ');
  const ranges: { key: string; start: number; end: number }[] = [];
  let offset = 0;
  kept.forEach((part, index) => {
    ranges.push({ key: part.key, start: offset, end: offset + pieces[index].length });
    offset += pieces[index].length + 1;
  });
  const map: string[][] = [];
  let cursor = 0;
  for (const chunk of chunks) {
    const at = joined.indexOf(normalize(chunk), cursor);
    if (at < 0) return [];
    const end = at + normalize(chunk).length;
    map.push(ranges.filter((range) => range.start < end && range.end > at).map((range) => range.key));
    cursor = end;
  }
  return map;
}

/** The chunks device speech will read for these parts (same functions as the plan). */
export function narrationChunks(parts: readonly NarrationPart[]): string[] {
  return splitIntoChunks(joinNarration(parts.map((part) => part.text)));
}

export type ListenState = {
  /** This content's narration session is the active one. */
  active: boolean;
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'finished' | 'error';
  /** Device speech chunk; null for recorded audio. */
  chunk: number | null;
  /** True for recorded audio (seekable, no authored timestamps). */
  recorded: boolean;
};

/** Sections to highlight now - only for device speech that is really on this content. */
export function activeSections(state: ListenState, map: readonly string[][]): string[] {
  if (!state.active || state.recorded || state.chunk === null) return [];
  if (state.status !== 'playing' && state.status !== 'paused') return [];
  return (map[state.chunk] ?? []).filter((key) => key !== 'title');
}

/** After the person scrolls by hand, follow mode waits this long. */
export const FOLLOW_PAUSE_MS = 6000;

export function shouldAutoScroll(followOn: boolean, lastManualScrollAt: number | null, now: number): boolean {
  if (!followOn) return false;
  return lastManualScrollAt === null || now - lastManualScrollAt >= FOLLOW_PAUSE_MS;
}
