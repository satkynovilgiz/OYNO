import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { isWidgetSnapshotPublicSafe, PUBLIC_WIDGET_KEY, type PublicWidgetSnapshot } from './publicWidgetSnapshot';

/** UserDefaults key (in the shared App Group) the Swift widget reads -
 * must match `snapshotKey` in targets/widget/OYNOWidgetData.swift. */
export const WIDGET_SNAPSHOT_KEY = PUBLIC_WIDGET_KEY;
/** Earlier builds wrote a v1 snapshot that included personal progress -
 * removed from the App Group on the first v2 write. */
export const LEGACY_WIDGET_KEYS = ['oyno.widgetSnapshot.v1'] as const;

const RELOAD_DEBOUNCE_MS = 1500;

/**
 * The App Group id, read from the ONE place it's declared: app.json
 * `ios.entitlements['com.apple.security.application-groups']` (the widget
 * target mirrors that value via @bacons/apple-targets, and the Swift side
 * derives the same id from its own bundle id).
 */
export function widgetAppGroup(): string | null {
  const groups = Constants.expoConfig?.ios?.entitlements?.['com.apple.security.application-groups'] as string[] | undefined;
  return groups?.find((group) => group.endsWith('.widgets')) ?? null;
}

/** Everything except the timestamp - a new write (and a widget reload)
 * happens only when something the widget shows actually changed. */
export function snapshotSignature(snapshot: PublicWidgetSnapshot): string {
  const { generatedAt: _generatedAt, ...rest } = snapshot;
  return JSON.stringify(rest);
}

let lastSignature: string | null = null;
let legacyCleared = false;
let pending: ReturnType<typeof setTimeout> | null = null;

/**
 * Writes the public snapshot for the native widget and reloads its
 * timeline. iOS only; a no-op on Android/web, in Expo Go, and on builds
 * without the widget extension. Refuses anything that fails
 * isWidgetSnapshotPublicSafe(). Debounced, and skipped when nothing
 * visible changed, so state churn never spams WidgetKit reloads.
 */
export function publishWidgetSnapshot(snapshot: PublicWidgetSnapshot): void {
  if (Platform.OS !== 'ios') return;
  if (!isWidgetSnapshotPublicSafe(snapshot)) return;
  const group = widgetAppGroup();
  if (!group) return;
  const signature = snapshotSignature(snapshot);
  if (signature === lastSignature) return;
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    try {
      // Lazy: the package touches a native global at import time.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ExtensionStorage } = require('@bacons/apple-targets') as typeof import('@bacons/apple-targets');
      const storage = new ExtensionStorage(group);
      if (!legacyCleared) {
        for (const key of LEGACY_WIDGET_KEYS) storage.remove(key);
        legacyCleared = true;
      }
      storage.set(WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot));
      ExtensionStorage.reloadWidget();
      lastSignature = signature;
    } catch {
      // Widget support unavailable in this build - nothing to update.
    }
  }, RELOAD_DEBOUNCE_MS);
}
