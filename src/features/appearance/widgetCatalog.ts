import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/**
 * The OYNO widget ("Today in OYNO") and the sizes it really supports - a mirror of
 * `supportedFamilies` in targets/widget/OYNOWidgets.swift (a test parses
 * the Swift file so this list can never advertise a size the native widget
 * doesn't have).
 */
export type WidgetFamily = 'small' | 'medium';
export type WidgetKind = 'today';

export const WIDGET_CATALOG: { kind: WidgetKind; swiftKind: string; families: WidgetFamily[] }[] = [{ kind: 'today', swiftKind: 'OYNOToday', families: ['small', 'medium'] }];

/** Swift `.systemSmall` etc. -> our family names. */
export const SWIFT_FAMILY: Record<string, WidgetFamily> = {
  systemSmall: 'small',
  systemMedium: 'medium',
};

/** 'installed' only in an iOS build that contains the widget extension's
 * native bridge; everywhere else (web, Android, Expo Go, older builds) the
 * screen shows previews and says honestly that widgets need the app. */
export function widgetAvailability(os: string = Platform.OS, hasNativeBridge: () => boolean = defaultBridgeCheck): 'installed' | 'unavailable' {
  if (os !== 'ios') return 'unavailable';
  return hasNativeBridge() ? 'installed' : 'unavailable';
}

function defaultBridgeCheck(): boolean {
  try {
    return !!requireOptionalNativeModule('ExtensionStorage');
  } catch {
    return false;
  }
}
