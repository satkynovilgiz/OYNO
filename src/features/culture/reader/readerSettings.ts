/**
 * Reader Mode + Reading Controls - presentation only for long-form Culture
 * text (culture_item / culture_material bodies). Nothing here touches the
 * content itself. Values are fixed presets (no free slider in v1) and they
 * MULTIPLY the existing size, so the system font scale (Dynamic Type)
 * still applies on top - it is never disabled or overridden.
 */

export type TextSizeId = 'small' | 'default' | 'large' | 'xl';
export type LineSpacingId = 'compact' | 'comfortable' | 'spacious';

export const TEXT_SIZES: Record<TextSizeId, number> = { small: 0.9, default: 1, large: 1.15, xl: 1.3 };
/** Line height as a multiple of the font size. */
export const LINE_SPACINGS: Record<LineSpacingId, number> = { compact: 1.4, comfortable: 1.56, spacious: 1.8 };

export type ReaderSettings = { textSize: TextSizeId; lineSpacing: LineSpacingId; focusMode: boolean };

export const DEFAULT_READER_SETTINGS: ReaderSettings = { textSize: 'default', lineSpacing: 'comfortable', focusMode: false };

/** The ADULT default body size - a child's text never goes below it. */
const ADULT_BASE = 16;

/**
 * Body text style for a base size. Children read from their own larger
 * baseline: "Small" is small relative to THAT, and never smaller than the
 * standard default body size (child mode can't accidentally shrink).
 */
export function readerBodyStyle(baseFontSize: number, settings: Pick<ReaderSettings, 'textSize' | 'lineSpacing'>, isChild: boolean): { fontSize: number; lineHeight: number } {
  let fontSize = baseFontSize * TEXT_SIZES[settings.textSize];
  // The child floor never enlarges the default either: it is the lower of
  // this screen's own base and the standard body size.
  if (isChild) fontSize = Math.max(fontSize, Math.min(baseFontSize, ADULT_BASE));
  fontSize = Math.round(fontSize * 10) / 10;
  return { fontSize, lineHeight: Math.round(fontSize * LINE_SPACINGS[settings.lineSpacing]) };
}

export function isTextSize(value: unknown): value is TextSizeId {
  return typeof value === 'string' && value in TEXT_SIZES;
}

export function isLineSpacing(value: unknown): value is LineSpacingId {
  return typeof value === 'string' && value in LINE_SPACINGS;
}

/** Stored settings, validated (anything unknown falls back to defaults). */
export function sanitizeSettings(raw: unknown): ReaderSettings {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof ReaderSettings, unknown>>;
  return {
    textSize: isTextSize(value.textSize) ? value.textSize : DEFAULT_READER_SETTINGS.textSize,
    lineSpacing: isLineSpacing(value.lineSpacing) ? value.lineSpacing : DEFAULT_READER_SETTINGS.lineSpacing,
    focusMode: value.focusMode === true,
  };
}
