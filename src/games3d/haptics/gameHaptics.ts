import * as Haptics from 'expo-haptics';

import { useSettingsStore } from '@/store/useSettingsStore';

/** Shared haptics entry point for the 3D games (Section "add subtle haptics"
 * / "don't spam haptics" / "gracefully handle platforms where haptics are
 * unavailable") - every game should call through here instead of
 * `expo-haptics` directly, so the global `useSettingsStore().game.haptics`
 * toggle and the spam guard below only need to exist once.
 *
 * `expo-haptics`'s web implementation already falls back to
 * `navigator.vibrate`/a no-op by itself (see its `ExpoHaptics.web.ts`), and
 * both native platforms treat a missing haptics engine as a rejected
 * promise rather than a throw - the try/catch below is what actually
 * "gracefully handles" that, since an unawaited rejection would otherwise
 * surface as an unhandled promise rejection warning. */
const MIN_INTERVAL_MS = 120;
let lastFiredAtMs = 0;

function hapticsEnabled(): boolean {
  return useSettingsStore.getState().game.haptics;
}

async function fire(trigger: () => Promise<void>): Promise<void> {
  if (!hapticsEnabled()) return;
  const now = Date.now();
  if (now - lastFiredAtMs < MIN_INTERVAL_MS) return;
  lastFiredAtMs = now;
  try {
    await trigger();
  } catch {
    // No haptics engine on this device/simulator - safe to ignore.
  }
}

export const gameHaptics = {
  light: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  heavy: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  success: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
