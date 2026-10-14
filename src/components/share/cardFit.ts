/**
 * Export card text fitting - ONE deterministic rule for preview and export
 * (no platform auto-shrinking: `adjustsFontSizeToFit` behaves differently
 * on iOS, Android and web, so the exported image could differ from the
 * preview). Text inside a card ignores system font scaling: the card has a
 * fixed logical size and is captured at 3x.
 *
 *   1. Try each size of the role, largest first; the first size at which
 *      the text fits in `maxLines` lines wins.
 *   2. Nothing fits: the smallest size, cut at a word boundary with "…",
 *      and `shortened: true` - the card then shows a visible note
 *      ("Shortened to fit the card"), so nothing is silently cut off.
 *
 * Line estimate: average glyph width ~ 0.62 em - measured on the exported
 * KG journal card (bold serif Cyrillic ran ~0.6 em; 0.56 under-counted a
 * line), so the factor errs on the wide side and the renderer never has
 * to add its own ellipsis.
 */
export type FitRole = { sizes: readonly number[]; maxLines: number; width: number; lineHeight: number };
export type Fitted = { text: string; fontSize: number; lineHeight: number; lines: number; shortened: boolean };

const GLYPH_EM = 0.62;
export const charsPerLine = (width: number, fontSize: number) => Math.max(4, Math.floor(width / (fontSize * GLYPH_EM)));

/** Greedy word wrap: how many lines `text` takes at `perLine` characters. */
export function lineCount(text: string, perLine: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  let lines = 1;
  let used = 0;
  for (const word of words) {
    if (word.length > perLine) {
      // A word longer than a line starts on its own line and is broken across lines.
      if (used > 0) lines += 1;
      lines += Math.ceil(word.length / perLine) - 1;
      used = word.length % perLine || perLine;
    } else if (used === 0) used = word.length;
    else if (used + 1 + word.length <= perLine) used += 1 + word.length;
    else {
      lines += 1;
      used = word.length;
    }
  }
  return lines;
}

export function fitCardText(raw: string, role: FitRole): Fitted {
  const text = raw.replace(/\s+/g, ' ').trim();
  for (const fontSize of role.sizes) {
    const lines = lineCount(text, charsPerLine(role.width, fontSize));
    if (lines <= role.maxLines) return { text, fontSize, lineHeight: Math.round(fontSize * role.lineHeight), lines, shortened: false };
  }
  const fontSize = role.sizes[role.sizes.length - 1];
  const budget = charsPerLine(role.width, fontSize) * role.maxLines - 1;
  let cut = text.slice(0, Math.max(1, budget));
  const space = cut.lastIndexOf(' ');
  if (space > budget * 0.6) cut = cut.slice(0, space);
  const shortenedText = `${cut.replace(/[\s,.;:–-]+$/, '')}…`;
  return { text: shortenedText, fontSize, lineHeight: Math.round(fontSize * role.lineHeight), lines: role.maxLines, shortened: true };
}

/** The roles used by the share cards (widths are the cards' inner text widths). */
export const CARD_FIT = {
  /** Photo / story card title over the picture. */
  heroTitle: { sizes: [34, 28, 24], maxLines: 3, width: 320, lineHeight: 1.18 },
  /** Score card title under the big number. */
  scoreTitle: { sizes: [26, 22], maxLines: 2, width: 320, lineHeight: 1.22 },
  /** Paper cards (journal, creation): title under the picture/artwork. */
  paperTitle: { sizes: [26, 22, 19], maxLines: 2, width: 320, lineHeight: 1.2 },
  /** Badge and summary titles. */
  centerTitle: { sizes: [30, 26, 22], maxLines: 2, width: 320, lineHeight: 1.2 },
  /** One short line (subtitle, excerpt, a summary figure). */
  line: { sizes: [17, 15], maxLines: 2, width: 320, lineHeight: 1.36 },
  /** A summary figure line. */
  figure: { sizes: [24, 20, 17], maxLines: 1, width: 320, lineHeight: 1.25 },
  /** Small labels (category, linked content). */
  label: { sizes: [12, 11], maxLines: 1, width: 280, lineHeight: 1.3 },
} as const satisfies Record<string, FitRole>;
