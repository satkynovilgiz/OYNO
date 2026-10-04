/**
 * Accessibility & Comfort - pure rules (device-level preferences).
 *
 *   reduceMotion   OR-ed with the SYSTEM Reduce Motion (system stays
 *                  authoritative: OYNO can add calm, never remove it)
 *   haptics        standard | reduced (only meaningful confirmations:
 *                  success / warning / error) | off
 *   largerControls minimum touch target 56 instead of 44/48 - targets only,
 *                  layouts aren't scaled; works with every age mode
 *   highContrast   an explicit semantic palette adjustment (darker muted
 *                  text, stronger borders/chips) applied at app start
 */

export type HapticsMode = 'standard' | 'reduced' | 'off';
export type ComfortPrefs = { reduceMotion: boolean; haptics: HapticsMode; largerControls: boolean; highContrast: boolean };
export const DEFAULT_COMFORT: ComfortPrefs = { reduceMotion: false, haptics: 'standard', largerControls: false, highContrast: false };

export function sanitizeComfort(raw: unknown): ComfortPrefs {
  const value = raw && typeof raw === 'object' ? (raw as Partial<ComfortPrefs>) : {};
  return {
    reduceMotion: value.reduceMotion === true,
    haptics: value.haptics === 'reduced' || value.haptics === 'off' ? value.haptics : 'standard',
    largerControls: value.largerControls === true,
    highContrast: value.highContrast === true,
  };
}

export function effectiveReducedMotion(system: boolean, prefs: Pick<ComfortPrefs, 'reduceMotion'>): boolean {
  return system || prefs.reduceMotion;
}

export type HapticKind = 'impact' | 'selection' | 'notification';
export function hapticAllowed(mode: HapticsMode, kind: HapticKind): boolean {
  if (mode === 'off') return false;
  if (mode === 'reduced') return kind === 'notification';
  return true;
}

/** Minimum interactive size (pt). Applied to buttons, icon buttons, chips, game menus. */
export const STANDARD_MIN_TARGET = 44;
export const LARGE_MIN_TARGET = 56;
export function minTarget(prefs: Pick<ComfortPrefs, 'largerControls'>, base: number = STANDARD_MIN_TARGET): number {
  return prefs.largerControls ? Math.max(base, LARGE_MIN_TARGET) : base;
}

/**
 * Higher contrast: explicit replacements for the semantic tokens that
 * carry low-contrast information. Same OYNO hues, deeper values - not
 * "everything black". Ratios vs the cream background (#F3E5C9):
 *   textMuted     #786550 (4.47:1) -> #4F3F30 (8.08:1)
 *   textSecondary #6B5A47 (5.30:1) -> #3F3226 (9.94:1)
 * (measured with contrastRatio() below; muted stays lighter than secondary)
 *   borderSubtle  #E0CFAC          -> #A88C62 (visible outline)
 *   border        #C9A876          -> #8B6B3D
 *   surfaceBorder #E0CFAC          -> #A88C62
 */
export const HIGH_CONTRAST_TOKENS = {
  textMuted: '#4F3F30',
  textSecondary: '#3F3226',
  borderSubtle: '#A88C62',
  border: '#8B6B3D',
  surfaceBorder: '#A88C62',
  accentTerracotta: '#8F4A21',
} as const;

/** WCAG relative-luminance contrast (for tests and the screen's own checks). */
export function contrastRatio(foreground: string, background: string): number {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [a, b] = [lum(foreground), lum(background)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}
