/**
 * Reader Navigator + Table of Contents - pure rules.
 *
 * Sections are the article's EXISTING authored sections, exactly as the
 * screen renders them (the same keys Read & Listen and saved highlights
 * use). Nothing is stored as pixels: positions are measured from the live
 * layout each time; only a section KEY may be remembered (alongside the
 * existing reading progress record).
 */

export type NavSection = { key: string; label: string };

/** Fewer rendered sections than this: no Contents button. */
export const MIN_TOC_SECTIONS = 3;

/** Section keys are field names ("history", "cultural_meaning"…). */
export const SECTION_KEY_PATTERN = /^[a-z][a-z0-9_]{0,59}$/;

export function isSectionKey(value: unknown): value is string {
  return typeof value === 'string' && SECTION_KEY_PATTERN.test(value);
}

/** The Table of Contents, or null when the article is too short for one. */
export function tableOfContents(sections: readonly NavSection[]): NavSection[] | null {
  const meaningful = sections.filter((section) => isSectionKey(section.key) && section.label.trim());
  return meaningful.length >= MIN_TOC_SECTIONS ? meaningful : null;
}

/** Fraction of the viewport below the top edge that counts as "reading here". */
export const READING_LINE = 0.3;

/**
 * The section being read: the last one whose top is above the reading
 * line. Tops are absolute content offsets measured from the CURRENT layout.
 * Null before the first section or while nothing is measured.
 */
export function currentSectionAt(tops: readonly { key: string; top: number }[], scrollY: number, viewportHeight: number): string | null {
  const line = scrollY + Math.max(0, viewportHeight) * READING_LINE;
  let current: string | null = null;
  for (const entry of [...tops].sort((a, b) => a.top - b.top)) {
    if (!Number.isFinite(entry.top)) continue;
    if (entry.top <= line) current = entry.key;
    else break;
  }
  return current;
}

/** Where to scroll for a section: a little above its heading, never negative. */
export function jumpOffset(top: number, padding = 24): number {
  return Math.max(0, Math.round(top - padding));
}

/**
 * Resume target. The remembered section is used only when it still exists
 * in the article as rendered now (content edits, language or age depth can
 * remove it) - otherwise null and the caller falls back to the existing
 * ratio-based progress.
 */
export function resumeSection(lastSectionKey: string | null | undefined, sections: readonly NavSection[]): string | null {
  if (!isSectionKey(lastSectionKey)) return null;
  return sections.some((section) => section.key === lastSectionKey) ? lastSectionKey : null;
}

/** "History, section 2 of 5" (+ ", you are here"). */
export function sectionA11yLabel(section: NavSection, position: number, total: number, current: boolean, words: { sectionOf: (position: number, total: number) => string; youAreHere: string }): string {
  return `${section.label}, ${words.sectionOf(position, total)}${current ? `, ${words.youAreHere}` : ''}`;
}
