import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { hapticAllowed } from './comfort';
import { comfortPrefs } from './useComfortStore';

/**
 * THE haptics entry point - every vibration in OYNO goes through here so
 * the Accessibility & Comfort setting (standard / reduced / off) applies
 * everywhere, games included. Reduced keeps only meaningful confirmations
 * (success / warning / error notifications). Always resolves.
 */
const IMPACT = { light: Haptics.ImpactFeedbackStyle.Light, medium: Haptics.ImpactFeedbackStyle.Medium, heavy: Haptics.ImpactFeedbackStyle.Heavy } as const;
const NOTIFY = { success: Haptics.NotificationFeedbackType.Success, warning: Haptics.NotificationFeedbackType.Warning, error: Haptics.NotificationFeedbackType.Error } as const;

const skip = () => Platform.OS === 'web';

export function hapticImpact(style: keyof typeof IMPACT): Promise<void> {
  if (skip() || !hapticAllowed(comfortPrefs().haptics, 'impact')) return Promise.resolve();
  return Haptics.impactAsync(IMPACT[style]).catch(() => undefined);
}

export function hapticSelection(): Promise<void> {
  if (skip() || !hapticAllowed(comfortPrefs().haptics, 'selection')) return Promise.resolve();
  return Haptics.selectionAsync().catch(() => undefined);
}

export function hapticNotify(type: keyof typeof NOTIFY): Promise<void> {
  if (skip() || !hapticAllowed(comfortPrefs().haptics, 'notification')) return Promise.resolve();
  return Haptics.notificationAsync(NOTIFY[type]).catch(() => undefined);
}
