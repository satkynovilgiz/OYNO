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
