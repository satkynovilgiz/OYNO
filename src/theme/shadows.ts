import { Platform } from 'react-native';
import { colors } from './colors';

// Soft warm shadow used by all cards. Android has no shadowOpacity/radius,
// so elevation is tuned separately to give a visually comparable result.
export const shadows = {
  card: Platform.select({
    android: { elevation: 4 },
    default: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.14,
      shadowRadius: 12,
    },
  }),
  raised: Platform.select({
    android: { elevation: 8 },
    default: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 18,
    },
  }),
} as const;

/**
 * Elevation ladder (design system v2). OYNO layers mostly by tone (cream
 * on cream, photography on cream); real shadows are reserved for things
 * that float: `floating` for sheets, toasts, floating controls and the tab
 * bar; `soft` for the rare raised control. Cards use `none`.
 */
export const elevation = {
  none: {},
  soft: Platform.select({
    android: { elevation: 2 },
    default: { shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
  }),
  floating: Platform.select({
    android: { elevation: 10 },
    default: { shadowColor: colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 20 },
  }),
} as const;
