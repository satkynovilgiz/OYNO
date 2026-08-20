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
