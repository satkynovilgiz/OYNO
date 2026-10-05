/**
 * Accessibility guards: theme text/background pairs used by the audited
 * screens keep WCAG AA contrast (measured, not eyeballed), screen-reader
 * announcements reach the platform API, and shared controls expose their
 * state as aria-* (react-native-web drops `accessibilityState`).
 */
import * as fs from 'fs';
import * as path from 'path';

import { AccessibilityInfo } from 'react-native';

import { contentTypeMeta } from '@/components/library/contentTypeMeta';
import { colors } from '@/theme';

import { announce } from './announce';

// Icons are irrelevant here (ESM package Jest does not transform).
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const AA = 4.5;

describe('contrast (WCAG AA 4.5:1 for normal text)', () => {
  const backgrounds = { background: colors.background, surface: colors.surface };

  it.each([
    ['textPrimary', colors.textPrimary],
    ['textSecondary', colors.textSecondary],
    ['textMuted', colors.textMuted],
    ['accentTerracottaText', colors.accentTerracottaText],
    ['accentGoldText', colors.accentGoldText],
    ['primary', colors.primary],
  ])('%s on background and surface', (_name, text) => {
    for (const [bgName, bg] of Object.entries(backgrounds)) expect([bgName, contrast(text, bg) >= AA]).toEqual([bgName, true]);
  });

  it('white label on the destructive and primary button fills', () => {
    expect(contrast(colors.textOnPrimary, colors.dangerFill)).toBeGreaterThanOrEqual(AA);
    expect(contrast(colors.textOnPrimary, colors.primary)).toBeGreaterThanOrEqual(AA);
  });

  it('every content-type label colour (search results, library rows)', () => {
    for (const type of ['game', 'nature', 'region', 'culture_item', 'culture_category', 'culture_material', 'interactive_experience', 'trail', 'collection'] as const) {
      expect([type, contrast(contentTypeMeta(type).textTone, colors.background) >= AA]).toEqual([type, true]);
    }
  });

  it('documents the brand shades that are NOT for small text (they stay for fills/marks)', () => {
    expect(contrast(colors.accentTerracotta, colors.background)).toBeLessThan(AA);
    expect(contrast(colors.accentGoldPressed, colors.background)).toBeLessThan(AA);
  });
});

describe('announce', () => {
  it('native: goes to the platform screen reader', () => {
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    announce('1 ready offline');
    expect(spy).toHaveBeenCalledWith('1 ready offline');
    announce('');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe('shared controls expose state as aria-* (web drops accessibilityState)', () => {
  const read = (file: string) => fs.readFileSync(path.join(__dirname, '../../..', file), 'utf8');
  it.each([
    ['src/components/ui/Button.tsx', ['aria-disabled={isDisabled}', 'aria-busy={loading || (keepFocusWhenDisabled && isDisabled)}']],
    ['src/components/ui/Chip.tsx', ['aria-selected={selected}']],
    ['src/components/ui/IconButton.tsx', ['aria-disabled={disabled}']],
    ['src/components/ui/Toggle.tsx', ['aria-checked={value}', 'aria-disabled={disabled}']],
    ['src/components/ui/TextButton.tsx', ['aria-disabled={disabled}']],
  ])('%s', (file, props) => {
    const source = read(file);
    for (const prop of props) expect(source).toContain(prop);
  });

  it('dialogs are named on web and decorative images have an empty text alternative', () => {
    expect(read('src/components/ui/ConfirmationModal.tsx')).toContain("'aria-label': title");
    expect(read('src/components/ui/MediaImage.tsx')).toContain('accessibilityLabel={alt}');
  });
});
