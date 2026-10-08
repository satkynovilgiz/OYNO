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

/** The outputs of a design set: two cards and a phone wallpaper. */
export type PostcardFormat = 'portrait' | 'square' | 'wallpaper';
export const FORMATS: PostcardFormat[] = ['square', 'portrait', 'wallpaper'];
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
export const CARD_HEIGHT: Record<PostcardFormat, number> = { portrait: 450, square: 360, wallpaper: 780 };
/**
 * Wallpaper (360 x 780 -> 1080 x 2340, 19.5:9): a SUGGESTED clock area at
 * the top and a reserve at the bottom (unlock bar / shortcuts) where the
 * greeting is never placed. Lock screens differ between phones, so this is
 * a guide, not a guarantee; the pattern may sit behind it.
 */
export const CLOCK_ZONE = { x: 0, y: 56, width: 360, height: 236 };
export const BOTTOM_RESERVE = 96;
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
export const GREETING_SIZES = [24, 20, 17, 15, 13] as const;
export const LINE_HEIGHT = 1.4;

/**
 * Conservative advance widths (em) for the bold system font, per character
 * class. One table drives BOTH the size choice and the fit check, so the
 * size chosen is the size that was checked. Values round UP the widest
 * glyph of each class (bold SF / Roboto / Helvetica measured in the web
 * build, see docs/OYMO_POSTCARD.md); the e2e test re-measures real text.
 */
const WIDE_UPPER = new Set([...'ЖШЩЮМWMФЫ@%Ꙗ']);
const WIDE_LOWER = new Set([...'жшщюмwmфы']);
const NARROW = new Set([...' iIlj.,:;!|\'"`()[]-']);
export function glyphEm(char: string): number {
  if (WIDE_UPPER.has(char)) return 1.05;
  if (WIDE_LOWER.has(char)) return 0.9;
  if (NARROW.has(char)) return 0.4;
  const code = char.codePointAt(0) ?? 0;
  // Emoji and other pictographs.
  if (code >= 0x2190 && !/\p{L}/u.test(char)) return 1.3;
  if (/\p{Lu}|\p{N}/u.test(char)) return 0.8;
  return 0.68;
}
const wordWidth = (word: string, fontSize: number) => [...word].reduce((sum, char) => sum + glyphEm(char) * fontSize, 0);

/**
 * Greedy word wrap as a text engine does it: words move to the next line
 * when they don't fit; a word wider than the line is broken across lines.
 * Returns the number of lines.
 */
export function wrapLines(text: string, fontSize: number, width: number): number {
  if (!text) return 0;
  const space = glyphEm(' ') * fontSize;
  let lines = 1;
  let used = 0;
  for (const word of text.split(' ')) {
    const size = wordWidth(word, fontSize);
    if (used > 0 && used + space + size <= width) {
      used += space + size;
      continue;
    }
    if (used > 0) {
      lines += 1;
      used = 0;
    }
    if (size <= width) {
      used = size;
      continue;
    }
    // Too long for one line: break by characters.
    for (const char of word) {
      const advance = glyphEm(char) * fontSize;
      if (used + advance > width) {
        lines += 1;
        used = 0;
      }
      used += advance;
    }
  }
  return lines;
}

export const lineHeightFor = (fontSize: number) => Math.round(fontSize * LINE_HEIGHT);
export const textHeight = (text: string, fontSize: number, width: number) => wrapLines(text, fontSize, width) * lineHeightFor(fontSize);
export const fits = (text: string, fontSize: number, box: { width: number; height: number }) => textHeight(text, fontSize, box.width) <= box.height;

/** The largest size whose wrapped greeting fits the box (null only if even the smallest doesn't - never for <= GREETING_MAX letters, tested). */
export function greetingFontSize(text: string, box: { width: number; height: number }): number {
  return GREETING_SIZES.find((size) => fits(text, size, box)) ?? GREETING_SIZES[GREETING_SIZES.length - 1];
}

const SIZE_FACTOR: Record<PatternSize, number> = { small: 0.6, medium: 0.8, large: 1 };
const GREETING_HEIGHT = 132;
/** Inner padding of the greeting box (the text gets box.width - 2 x this). */
export const GREETING_PADDING = 8;
export const greetingTextBox = (box: Box) => ({ width: box.width - GREETING_PADDING * 2, height: box.height - GREETING_PADDING * 2 });

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
/** Where the greeting may go: inside the margins, and on a wallpaper below the clock area and above the bottom reserve. */
export function textZone(format: PostcardFormat): { top: number; bottom: number } {
  const height = CARD_HEIGHT[format];
  return format === 'wallpaper' ? { top: CLOCK_ZONE.y + CLOCK_ZONE.height + 16, bottom: height - BOTTOM_RESERVE } : { top: MARGIN, bottom: height - MARGIN };
}

export function frameFor(composition: PostcardComposition): PostcardFrame {
  const card = cardSize(composition.format);
  const zone = textZone(composition.format);
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
      const top = Math.max(middle.y, zone.top);
      const bottom = Math.min(middle.y + middle.height, zone.bottom);
      return { card, pattern: { x: 0, y: 0, width: strip, height: strip }, strips, greeting: greetingBox(top + (bottom - top - GREETING_HEIGHT) / 2) };
    }
    const side = Math.min(middle.height, inner.width) * SIZE_FACTOR[composition.size];
    return { card, pattern: { x: (card.width - side) / 2, y: middle.y + (middle.height - side) / 2, width: side, height: side }, strips, greeting: null };
  }

  if (composition.layout === 'banner') {
    // The pattern fills a full-width band; the greeting sits below it.
    const greetingY = zone.bottom - GREETING_HEIGHT;
    const bandHeight = hasGreeting ? greetingY - MARGIN : card.height - MARGIN * 2;
    const side = Math.min(bandHeight, card.width - MARGIN * 2) * SIZE_FACTOR[composition.size];
    const free = bandHeight - side;
    const offset = composition.position === 'top' ? 0 : composition.position === 'bottom' ? free : free / 2;
    return { card, pattern: { x: (card.width - side) / 2, y: MARGIN + offset, width: side, height: side }, strips: [], greeting: hasGreeting ? greetingBox(greetingY) : null };
  }

  // classic: the pattern in the free area, the greeting at the bottom of its zone (or at its top when the pattern is placed at the bottom).
  const greetingAtTop = hasGreeting && composition.position === 'bottom';
  const greetingY = greetingAtTop ? zone.top : zone.bottom - GREETING_HEIGHT;
  const area = !hasGreeting ? { y: MARGIN, height: card.height - MARGIN * 2 } : greetingAtTop ? { y: greetingY + GREETING_HEIGHT + 12, height: card.height - MARGIN - (greetingY + GREETING_HEIGHT + 12) } : { y: MARGIN, height: greetingY - 12 - MARGIN };
  const side = Math.min(area.height, inner.width) * SIZE_FACTOR[composition.size];
  const free = area.height - side;
  const offset = composition.position === 'top' ? 0 : composition.position === 'bottom' ? free : free / 2;
  return {
    card,
    pattern: { x: (card.width - side) / 2, y: area.y + offset, width: side, height: side },
    strips: [],
    greeting: hasGreeting ? greetingBox(greetingY) : null,
  };
}

/** The share card for this composition: only the chosen pieces (built by the screen with the rendered card). */
export const exportSize = (format: PostcardFormat) => ({ width: CARD_WIDTH * EXPORT_SCALE, height: CARD_HEIGHT[format] * EXPORT_SCALE });

/**
 * A design set: ONE copy of the saved pattern, a shared palette
 * (background) and greeting, and an independent placement for each output.
 * Editing one output's placement never touches the others.
 */
export type OutputPlacement = Pick<PostcardComposition, 'layout' | 'size' | 'position'>;
export type DesignSet = Pick<PostcardComposition, 'sourceId' | 'artwork' | 'greeting' | 'background'> & { outputs: Record<PostcardFormat, OutputPlacement> };

export function startDesignSet(source: Parameters<typeof startPostcard>[0]): DesignSet {
  const base = startPostcard(source);
  const placement = (): OutputPlacement => ({ layout: base.layout, size: base.size, position: base.position });
  return { sourceId: base.sourceId, artwork: base.artwork, greeting: base.greeting, background: base.background, outputs: { square: placement(), portrait: placement(), wallpaper: placement() } };
}

export function compositionFor(set: DesignSet, format: PostcardFormat): PostcardComposition {
  return { sourceId: set.sourceId, artwork: set.artwork, greeting: set.greeting, background: set.background, format, ...set.outputs[format] };
}

/** Shared settings (greeting, palette) apply to every output. */
export function updateShared(set: DesignSet, patch: Partial<Pick<DesignSet, 'greeting' | 'background'>>): DesignSet {
  return { ...set, ...patch };
}

/** One output's placement; the other outputs are the same objects as before. */
export function updatePlacement(set: DesignSet, format: PostcardFormat, patch: Partial<OutputPlacement>): DesignSet {
  return { ...set, outputs: { ...set.outputs, [format]: { ...set.outputs[format], ...patch } } };
}
