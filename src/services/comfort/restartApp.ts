import { DevSettings, Platform } from 'react-native';

/** Restart OYNO so start-time settings (high-contrast palette) take effect. */
export async function restartApp(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.location.reload();
    return;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Updates = require('expo-updates') as typeof import('expo-updates');
    await Updates.reloadAsync();
  } catch {
    // Development builds without expo-updates reload.
    DevSettings.reload();
  }
}
