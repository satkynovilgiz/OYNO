import type { MotifLayer, SymmetryMode } from '@/services/culture/oymoEditor';
import { colors } from '@/theme';

/**
 * Oymo postcard - a card composed from a COPY of one saved pattern. Pure
 * layout rules only; the same numbers drive the live preview, the share
 * preview and the exported image (one component, one logical size, scaled
 * on capture), so the export matches the preview.
 *
 * Only what is chosen in this flow appears on the card: the copied pattern,
 * the background, and the optional greeting. No name, date, account,
 * pattern title or OYNO text is added.
 */

export type PostcardFormat = 'portrait' | 'square';
export const FORMATS: PostcardFormat[] = ['portrait', 'square'];
export type PostcardLayout = 'classic' | 'banner' | 'border';
export const LAYOUTS: PostcardLayout[] = ['classic', 'banner', 'border'];
export type PatternSize = 'small' | 'medium' | 'large';
export const SIZES: PatternSize[] = ['small', 'medium', 'large'];
export type PatternPosition = 'top' | 'center' | 'bottom';
export const POSITIONS: PatternPosition[] = ['top', 'center', 'bottom'];
export type PostcardBackground = 'pattern' | 'cream' | 'forest' | 'gold';
export const BACKGROUNDS: PostcardBackground[] = ['pattern', 'cream', 'forest', 'gold'];

/** Logical card size; exported at 3x (1080 x 1350 or 1080 x 1080). */
export const CARD_WIDTH = 360;
export const CARD_HEIGHT: Record<PostcardFormat, number> = { portrait: 450, square: 360 };
export const EXPORT_SCALE = 3;
export const GREETING_MAX = 80;
export const MARGIN = 24;

export type PostcardArtwork = { layers: MotifLayer[]; backgroundColor: string; symmetryMode: SymmetryMode };
export type PostcardComposition = {
  /** Which saved pattern it was copied from (never written back). */
  sourceId: string;
  artwork: PostcardArtwork;
  format: PostcardFormat;
  layout: PostcardLayout;
  greeting: string;
  size: PatternSize;
  position: PatternPosition;
  background: PostcardBackground;
};

/** A deep copy of the saved pattern: editing the postcard can never reach the original. */
export function startPostcard(source: { id: string; layers: readonly MotifLayer[]; background_color: string; symmetry_mode: SymmetryMode }): PostcardComposition {
  return {
    sourceId: source.id,
    artwork: { layers: source.layers.map((layer) => ({ ...layer, point: { ...layer.point } })), backgroundColor: source.background_color, symmetryMode: source.symmetry_mode },
    format: 'portrait',
    layout: 'classic',
    greeting: '',
    size: 'medium',
    position: 'center',
    background: 'cream',
  };
}

/** The greeting as it will be printed: whitespace collapsed, trimmed, at most GREETING_MAX characters (code points, so Kyrgyz/Cyrillic letters are never split). */
export function cleanGreeting(text: string): string {
  return [...text.replace(/\s+/g, ' ').trim()].slice(0, GREETING_MAX).join('');
}
/** While typing: newlines become spaces and the limit is enforced, but trailing spaces stay. */
export function typedGreeting(text: string): string {
  return [...text.replace(/[\r\n\t]+/g, ' ')].slice(0, GREETING_MAX).join('');
}
export const greetingLength = (text: string) => [...text].length;

export function cardSize(format: PostcardFormat) {
  return { width: CARD_WIDTH, height: CARD_HEIGHT[format] };
}

export function backgroundColor(composition: PostcardComposition): string {
  switch (composition.background) {
    case 'pattern':
      return composition.artwork.backgroundColor;
    case 'cream':
      return colors.surface;
    case 'forest':
      return colors.primary;
    case 'gold':
      return colors.accentGold;
  }
}

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value.slice(0, 6);
  const channel = (index: number) => {
    const c = parseInt(full.slice(index, index + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** Readable by default: dark ink or white, whichever contrasts more with the background. */
export function textColorOn(background: string): string {
  return contrast(colors.textPrimary, background) >= contrast(colors.textOnPrimary, background) ? colors.textPrimary : colors.textOnPrimary;
}

/**
 * How the greeting is drawn on this background: text alone when dark ink or
 * white reaches 4.5:1, otherwise on a cream plate (mid-tone pattern
 * backgrounds, where neither does).
 */
export function greetingStyle(background: string): { color: string; plate: string | null } {
  const color = textColorOn(background);
  if (contrast(color, background) >= 4.5) return { color, plate: null };
  return { color: colors.textPrimary, plate: colors.surface };
}

export type Box = { x: number; y: number; width: number; height: number };

/** Font sizes tried for the greeting, largest first; line height 1.4x keeps accents and descenders unclipped. */
export const GREETING_SIZES = [24, 20, 17, 15] as const;
export const LINE_HEIGHT = 1.4;
/** A conservative average glyph width (em) - wide enough for Ж/Ш/W-heavy text. */
const GLYPH_EM = 0.62;
/** The widest glyphs (Ж, Ш, Щ, Ю, W, M) - the worst case the box must still hold. */
const WIDE_EM = 0.95;

const linesNeeded = (text: string, fontSize: number, width: number, em = GLYPH_EM) => {
  // Greedy word wrap with an estimated width per character; a word longer than a line breaks across lines.
  const perLine = Math.max(1, Math.floor(width / (fontSize * em)));
  let lines = 1;
  let used = 0;
  for (const word of text.split(' ')) {
    const length = [...word].length;
    if (used === 0) {
      lines += Math.ceil(length / perLine) - 1;
      used = length % perLine || perLine;
    } else if (used + 1 + length <= perLine) used += 1 + length;
    else {
      lines += Math.ceil(length / perLine);
      used = length % perLine || perLine;
    }
  }
  return lines;
};

/** The largest size whose wrapped greeting fits the box; the smallest size always fits GREETING_MAX wide glyphs (tested). */
export function greetingFontSize(text: string, box: { width: number; height: number }): number {
  for (const size of GREETING_SIZES) {
    if (linesNeeded(text, size, box.width) * size * LINE_HEIGHT <= box.height) return size;
  }
  return GREETING_SIZES[GREETING_SIZES.length - 1];
}
/** Worst case at the smallest size (used by tests and docs). */
export const worstCaseHeight = (width: number) => linesNeeded('Ж'.repeat(GREETING_MAX), GREETING_SIZES[GREETING_SIZES.length - 1], width, WIDE_EM) * GREETING_SIZES[GREETING_SIZES.length - 1] * LINE_HEIGHT;

const SIZE_FACTOR: Record<PatternSize, number> = { small: 0.6, medium: 0.8, large: 1 };
const GREETING_HEIGHT = 120;

export type PostcardFrame = {
  card: { width: number; height: number };
  /** Where the pattern is drawn (always square, always inside the card). */
  pattern: Box;
  /** border layout: the strips filled with the pattern repeated. */
  strips: Box[];
  /** Where the greeting goes, or null without one. */
  greeting: Box | null;
};

/** Every box for this composition. Pattern and greeting never overlap; all stay inside the card. */
export function frameFor(composition: PostcardComposition): PostcardFrame {
  const card = cardSize(composition.format);
  const hasGreeting = cleanGreeting(composition.greeting).length > 0;
  const inner = { x: MARGIN, width: card.width - MARGIN * 2 };
  const greetingBox = (y: number): Box => ({ x: inner.x, y, width: inner.width, height: GREETING_HEIGHT });

  if (composition.layout === 'border') {
    // Pattern tiles fill a strip at the top and bottom; the greeting (or a larger pattern) sits between.
    const strip = Math.round(card.height * 0.2);
    const strips = [
      { x: 0, y: 0, width: card.width, height: strip },
      { x: 0, y: card.height - strip, width: card.width, height: strip },
    ];
    const middle = { y: strip + 12, height: card.height - strip * 2 - 24 };
    if (hasGreeting) {
      return { card, pattern: { x: 0, y: 0, width: strip, height: strip }, strips, greeting: { x: inner.x, y: middle.y + (middle.height - GREETING_HEIGHT) / 2, width: inner.width, height: GREETING_HEIGHT } };
    }
    const side = Math.min(middle.height, inner.width) * SIZE_FACTOR[composition.size];
    return { card, pattern: { x: (card.width - side) / 2, y: middle.y + (middle.height - side) / 2, width: side, height: side }, strips, greeting: null };
  }

  if (composition.layout === 'banner') {
    // The pattern fills a full-width band; the greeting sits below it.
    const bandHeight = hasGreeting ? card.height - GREETING_HEIGHT - MARGIN * 2 : card.height - MARGIN * 2;
    const side = Math.min(bandHeight, card.width - MARGIN * 2) * SIZE_FACTOR[composition.size];
    const free = bandHeight - side;
    const offset = composition.position === 'top' ? 0 : composition.position === 'bottom' ? free : free / 2;
    return { card, pattern: { x: (card.width - side) / 2, y: MARGIN + offset, width: side, height: side }, strips: [], greeting: hasGreeting ? greetingBox(card.height - MARGIN - GREETING_HEIGHT) : null };
  }

  // classic: the pattern in the free area, the greeting at the bottom (or top when the pattern is placed at the bottom).
  const greetingAtTop = hasGreeting && composition.position === 'bottom';
  const area = { y: MARGIN + (greetingAtTop ? GREETING_HEIGHT + 12 : 0), height: card.height - MARGIN * 2 - (hasGreeting ? GREETING_HEIGHT + 12 : 0) };
  const side = Math.min(area.height, inner.width) * SIZE_FACTOR[composition.size];
  const free = area.height - side;
  const offset = composition.position === 'top' ? 0 : composition.position === 'bottom' ? free : free / 2;
  return {
    card,
    pattern: { x: (card.width - side) / 2, y: area.y + offset, width: side, height: side },
    strips: [],
    greeting: hasGreeting ? greetingBox(greetingAtTop ? MARGIN : card.height - MARGIN - GREETING_HEIGHT) : null,
  };
}

/** The share card for this composition: only the chosen pieces (built by the screen with the rendered card). */
export const exportSize = (format: PostcardFormat) => ({ width: CARD_WIDTH * EXPORT_SCALE, height: CARD_HEIGHT[format] * EXPORT_SCALE });
