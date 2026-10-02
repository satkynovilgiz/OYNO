/**
 * Culture Highlights + Private Notes - pure rules. A highlight is a WHOLE
 * authored section (a stable source field like `history`), never an
 * arbitrary character range: v1 has no fragile text selection and no
 * pixel anchors. The saved passage is snapshotted (the source may change
 * later); whole articles are never stored. Notes are the user's own text -
 * never translated, never analysed, never sent anywhere.
 */

export type HighlightContentType = 'culture_item' | 'culture_material';

export type ContentHighlight = {
  id: string;
  contentType: HighlightContentType;
  contentId: string;
  /** The stable source field ("history", "cultural_meaning", "body"...). */
  sectionKey: string;
  /** App language when saved - the snapshot stays in it. */
  language: string;
  /** Title of the source at save time (readable even if the source goes). */
  titleSnapshot: string;
  excerptSnapshot: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HighlightsData = Record<string, ContentHighlight>;

export const NOTE_MAX = 500;
/** One section, not an article - long sections are kept to this length. */
export const EXCERPT_MAX = 1500;

export function highlightId(contentType: HighlightContentType, contentId: string, sectionKey: string, language: string): string {
  return `${contentType}:${contentId}:${sectionKey}:${language}`;
}

export function snapshotOf(text: string): string {
  const trimmed = text.trim();
  return trimmed.length <= EXCERPT_MAX ? trimmed : `${trimmed.slice(0, EXCERPT_MAX).trimEnd()}…`;
}

/** Saves a passage; the same section in the same language is never
 * duplicated (saving again returns the existing highlight unchanged). */
export function savePassage(
  data: HighlightsData,
  input: { contentType: HighlightContentType; contentId: string; sectionKey: string; language: string; title: string; text: string },
  now = new Date(),
): { data: HighlightsData; highlight: ContentHighlight; created: boolean } {
  const id = highlightId(input.contentType, input.contentId, input.sectionKey, input.language);
  const existing = data[id];
  if (existing) return { data, highlight: existing, created: false };
  const at = now.toISOString();
  const highlight: ContentHighlight = {
    id,
    contentType: input.contentType,
    contentId: input.contentId,
    sectionKey: input.sectionKey,
    language: input.language,
    titleSnapshot: input.title.trim(),
    excerptSnapshot: snapshotOf(input.text),
    note: null,
    createdAt: at,
    updatedAt: at,
  };
  return { data: { ...data, [id]: highlight }, highlight, created: true };
}

export type NoteProblem = 'tooLong';

export function validateNote(note: string): NoteProblem | null {
  return note.trim().length > NOTE_MAX ? 'tooLong' : null;
}

/** Add / edit (non-empty) or remove (empty) the note - the highlight stays. */
export function setNote(data: HighlightsData, id: string, note: string, now = new Date()): HighlightsData {
  const existing = data[id];
  if (!existing || validateNote(note)) return data;
  const trimmed = note.trim();
  return { ...data, [id]: { ...existing, note: trimmed ? trimmed : null, updatedAt: now.toISOString() } };
}

export function removeHighlight(data: HighlightsData, id: string): HighlightsData {
  if (!data[id]) return data;
  const next = { ...data };
  delete next[id];
  return next;
}

/** Newest first, deterministic. */
export function sortedHighlights(data: HighlightsData): ContentHighlight[] {
  return Object.values(data).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}

/** PRIVATE local search over title, excerpt and note. */
export function searchHighlights(list: readonly ContentHighlight[], query: string): ContentHighlight[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [...list];
  return list.filter((highlight) => [highlight.titleSnapshot, highlight.excerptSnapshot, highlight.note ?? ''].some((text) => text.toLocaleLowerCase().includes(needle)));
}

/**
 * "Source updated" only when it can be told reliably: the live section in
 * the SAME language exists and no longer starts with the saved passage.
 * Different language / not loaded -> unknown (no label, no fake diff).
 */
export function sourceUpdated(highlight: ContentHighlight, live: { language: string; text: string | null } | null): boolean {
  if (!live || live.language !== highlight.language || live.text === null) return false;
  const saved = highlight.excerptSnapshot.endsWith('…') ? highlight.excerptSnapshot.slice(0, -1) : highlight.excerptSnapshot;
  return !live.text.trim().startsWith(saved);
}

/** Guest -> account: union by id (same section+language), newest edit
 * wins, never duplicated. */
export function mergeHighlights(into: HighlightsData, from: HighlightsData): HighlightsData {
  const merged = { ...into };
  for (const [id, highlight] of Object.entries(from)) {
    const existing = merged[id];
    if (!existing || highlight.updatedAt > existing.updatedAt) merged[id] = highlight;
  }
  return merged;
}

/** Analytics carry structure only - never note, excerpt or section text. */
export function highlightEventProps(highlight: Pick<ContentHighlight, 'contentType' | 'contentId' | 'sectionKey'>): Record<string, string> {
  return { content_type: highlight.contentType, content_id: highlight.contentId, section_key: highlight.sectionKey };
}
