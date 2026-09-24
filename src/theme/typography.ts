import { Platform } from 'react-native';

const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });
const sans = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

export const fontFamily = {
  wordmark: serif,
  sans,
} as const;

export const typography = {
  wordmark: { fontFamily: serif, fontSize: 40, fontWeight: '700' as const, letterSpacing: 1 },
  display: { fontFamily: sans, fontSize: 24, fontWeight: '700' as const },
  h1: { fontFamily: sans, fontSize: 20, fontWeight: '700' as const },
  h2: { fontFamily: sans, fontSize: 17, fontWeight: '700' as const },
  body: { fontFamily: sans, fontSize: 15, fontWeight: '400' as const },
  bodyBold: { fontFamily: sans, fontSize: 15, fontWeight: '700' as const },
  caption: { fontFamily: sans, fontSize: 13, fontWeight: '500' as const },
  small: { fontFamily: sans, fontSize: 11, fontWeight: '600' as const },
  overline: {
    fontFamily: sans,
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
} as const;

export type TypographyToken = keyof typeof typography;

/**
 * Semantic type scale (design system v2). Sizes follow the product brief:
 * display 30, h1 26, h2 22 (section titles), h3 19, title 17 (card titles),
 * body 15-16, caption 13, small 12, overline 11. Every style carries an
 * explicit lineHeight so KG/RU titles that wrap to two lines keep an even
 * rhythm. Sans by default - `editorial()` swaps in the serif only where a
 * cinematic/editorial heading genuinely wants it (e.g. adult hero titles).
 */
export const textStyles = {
  display: { fontFamily: sans, fontSize: 30, lineHeight: 36, fontWeight: '800' as const, letterSpacing: -0.3 },
  h1: { fontFamily: sans, fontSize: 26, lineHeight: 31, fontWeight: '800' as const, letterSpacing: -0.2 },
  h2: { fontFamily: sans, fontSize: 22, lineHeight: 27, fontWeight: '800' as const, letterSpacing: -0.2 },
  h3: { fontFamily: sans, fontSize: 19, lineHeight: 24, fontWeight: '700' as const },
  title: { fontFamily: sans, fontSize: 17, lineHeight: 22, fontWeight: '700' as const },
  body: { fontFamily: sans, fontSize: 15, lineHeight: 21, fontWeight: '400' as const },
  bodyMedium: { fontFamily: sans, fontSize: 15, lineHeight: 21, fontWeight: '600' as const },
  caption: { fontFamily: sans, fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  small: { fontFamily: sans, fontSize: 12, lineHeight: 16, fontWeight: '600' as const },
  overline: { fontFamily: sans, fontSize: 11, lineHeight: 14, fontWeight: '700' as const, letterSpacing: 1.1, textTransform: 'uppercase' as const },
} as const;

export type TextStyleToken = keyof typeof textStyles;

/** Serif variant of a heading style - editorial use only. */
export function editorial<T extends object>(style: T): T & { fontFamily: string; letterSpacing: number } {
  return { ...style, fontFamily: serif, letterSpacing: 0 };
}
