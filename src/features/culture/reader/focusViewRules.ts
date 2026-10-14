/**
 * Focus view rules (FocusView.tsx renders them). Presentation only: the
 * article, its reading record and its notes are never changed by switching.
 */

/** Shown in BOTH views - Focus view never hides these. */
export const FOCUS_KEEPS = [
  'back',
  'textSettings', // text size + line spacing (existing reader settings)
  'contents', // Reader Navigator table of contents
  'focusToggle',
  'audioGuide', // narration + Read & Listen: accessibility, not decoration
  'sectionBookmark', // personal notes on a section
  'sourceLens', // per-section source information
  'glossary', // inline glossary terms + Key terms
  'sources', // Sources & notes
  'report',
  'markAsRead',
] as const;

/** Secondary interface that steps back while Focus view is on. */
export const FOCUS_HIDES = [
  'share',
  'favorite',
  'addToCollection',
  'sectionDividers',
  'passageActions', // save a quote
  'saveQuestion',
  'thenAndNow',
  'connections',
  'explainEntry',
  'nextVisit',
  'boardAndCompare',
  'quizLink',
  'gallery',
  'journalButton',
  'relatedRail',
] as const;

export type ViewSwitch = { kind: 'section'; key: string } | { kind: 'ratio' } | { kind: 'none' };

/**
 * What to restore when the view changes. The section being read (by KEY,
 * re-measured in the new layout) wins; without one (the hero, or an article
 * without sections) the reading RATIO is kept. Restoring is never reading:
 * it records no progress and no completion.
 */
export function restoreOnSwitch(previous: boolean, next: boolean, currentSection: string | null, validSections: readonly string[]): ViewSwitch {
  if (previous === next) return { kind: 'none' };
  if (currentSection && validSections.includes(currentSection)) return { kind: 'section', key: currentSection };
  return { kind: 'ratio' };
}

/** How long layout passes may still move the restored section (then the reader is in control). */
export const RESTORE_WINDOW_MS = 1200;
