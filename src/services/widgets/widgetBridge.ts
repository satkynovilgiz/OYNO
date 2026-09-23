import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { WidgetSnapshot } from './widgetSnapshot';

/** UserDefaults key (in the shared App Group) the Swift widgets read -
 * must match `snapshotKey` in targets/widget/OYNOWidgetData.swift. */
export const WIDGET_SNAPSHOT_KEY = 'oyno.widgetSnapshot.v1';

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
 * happens only when something the widgets show actually changed. */
export function snapshotSignature(snapshot: WidgetSnapshot): string {
  const { generatedAt: _generatedAt, ...rest } = snapshot;
  return JSON.stringify(rest);
}

let lastSignature: string | null = null;
let pending: ReturnType<typeof setTimeout> | null = null;

/**
 * Writes the snapshot for the native widgets and reloads their timelines.
 * iOS only; a no-op on Android/web, in Expo Go, and on builds made before
 * the widget extension existed (ExtensionStorage falls back to a stub when
 * its native module is missing). Debounced, and skipped entirely when
 * nothing visible changed, so state churn never spams WidgetKit reloads.
 */
export function publishWidgetSnapshot(snapshot: WidgetSnapshot): void {
  if (Platform.OS !== 'ios') return;
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
      new ExtensionStorage(group).set(WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot));
      ExtensionStorage.reloadWidget();
      lastSignature = signature;
    } catch {
      // Widget support unavailable in this build - nothing to update.
    }
  }, RELOAD_DEBOUNCE_MS);
}
