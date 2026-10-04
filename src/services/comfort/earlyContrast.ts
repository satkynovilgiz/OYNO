import { Platform } from 'react-native';

import { colors } from '../../theme/colors';
import { HIGH_CONTRAST_TOKENS } from './comfort';

/**
 * Higher contrast is applied BEFORE any screen module creates its styles
 * (index.js imports this first), because OYNO's styles copy color tokens
 * when they load. So the setting is read synchronously (SecureStore's sync
 * API on device, localStorage on web) and takes effect on the next start.
 */
const KEY = 'oyno.comfort.highContrast';

function readSync(): boolean {
  try {
    if (Platform.OS === 'web') return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
    return SecureStore.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function writeEarlyContrast(on: boolean): void {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, on ? '1' : '0');
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
    SecureStore.setItem(KEY, on ? '1' : '0');
  } catch {
    // Not available - the setting simply stays standard.
  }
}

/** True when the palette in memory is the high-contrast one (this run). */
export let highContrastActive = false;

export function applyEarlyContrast(): void {
  if (!readSync()) return;
  Object.assign(colors as unknown as Record<string, string>, HIGH_CONTRAST_TOKENS);
  highContrastActive = true;
}

applyEarlyContrast();
