import AsyncStorage from '@react-native-async-storage/async-storage';
import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { useReaderSettingsStore } from '@/store/useReaderSettingsStore';

import { contrastRatio, DEFAULT_COMFORT, effectiveReducedMotion, HIGH_CONTRAST_TOKENS, hapticAllowed, minTarget, sanitizeComfort } from './comfort';
import { COMFORT_KEY, useComfortStore } from './useComfortStore';

jest.mock('expo-secure-store', () => ({ getItem: jest.fn(() => null), setItem: jest.fn() }));

const root = path.join(__dirname, '../../..');
const BACKGROUND = '#F3E5C9';

describe('Accessibility & Comfort', () => {
  it('system Reduce Motion is authoritative; OYNO can only add calm', () => {
    expect(effectiveReducedMotion(true, { reduceMotion: false })).toBe(true);
    expect(effectiveReducedMotion(false, { reduceMotion: true })).toBe(true);
    expect(effectiveReducedMotion(false, { reduceMotion: false })).toBe(false);
    const hook = fs.readFileSync(path.join(root, 'src/services/motion/useReducedMotion.ts'), 'utf8');
    expect(hook).toMatch(/effectiveReducedMotion\(reduced, \{ reduceMotion: local \}\)/);
  });

  it('haptics: standard / reduced (confirmations only) / off', () => {
    expect(hapticAllowed('standard', 'impact')).toBe(true);
    expect(hapticAllowed('reduced', 'impact')).toBe(false);
    expect(hapticAllowed('reduced', 'selection')).toBe(false);
    expect(hapticAllowed('reduced', 'notification')).toBe(true);
    expect(['impact', 'selection', 'notification'].every((kind) => !hapticAllowed('off', kind as 'impact'))).toBe(true);
  });

  it('every haptic in the app goes through the central helper (games included)', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name) && !full.endsWith(path.join('comfort', 'haptics.ts'))) {
          const code = fs.readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
          if (/Haptics\.(impactAsync|selectionAsync|notificationAsync)/.test(code)) offenders.push(full);
        }
      }
    };
    walk(path.join(root, 'src'));
    expect(offenders).toEqual([]);
  });

  it('larger controls raise the touch target (44 -> 56), never shrink one', () => {
    expect(minTarget({ largerControls: false })).toBe(44);
    expect(minTarget({ largerControls: true })).toBe(56);
    expect(minTarget({ largerControls: true }, 60)).toBe(60);
    for (const file of ['Button.tsx', 'IconButton.tsx', 'Chip.tsx']) expect(fs.readFileSync(path.join(root, 'src/components/ui', file), 'utf8')).toMatch(/useMinTarget\(\)/);
  });

  it('higher contrast: explicit tokens, same hues, measurably stronger (AA+)', () => {
    expect(contrastRatio(HIGH_CONTRAST_TOKENS.textMuted, BACKGROUND)).toBeGreaterThan(contrastRatio('#786550', BACKGROUND));
    expect(contrastRatio(HIGH_CONTRAST_TOKENS.textMuted, BACKGROUND)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(HIGH_CONTRAST_TOKENS.textSecondary, BACKGROUND)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(HIGH_CONTRAST_TOKENS.borderSubtle, BACKGROUND)).toBeGreaterThan(contrastRatio('#E0CFAC', BACKGROUND));
    for (const value of Object.values(HIGH_CONTRAST_TOKENS)) expect(value).not.toBe('#000000');
  });

  it('contrast is applied before any screen loads (custom entry), honestly needs a restart', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { main: string };
    expect(pkg.main).toBe('index.js');
    const entry = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
    expect(entry.indexOf('earlyContrast')).toBeLessThan(entry.indexOf("'expo-router/entry'"));
    const screen = fs.readFileSync(path.join(root, 'src/features/settings/AccessibilityComfortScreen.tsx'), 'utf8');
    expect(screen).toMatch(/prefs\.highContrast !== highContrastActive/);
  });

  it('persists on the device; reset keeps age mode, language and Reader settings', async () => {
    useReaderSettingsStore.setState({ textSize: 'large' } as never);
    useComfortStore.getState().update({ largerControls: true, haptics: 'off' });
    expect(JSON.parse((await AsyncStorage.getItem(COMFORT_KEY))!)).toMatchObject({ largerControls: true, haptics: 'off' });
    useComfortStore.setState({ isLoaded: false, prefs: DEFAULT_COMFORT });
    await useComfortStore.getState().load();
    expect(useComfortStore.getState().prefs.haptics).toBe('off');
    useComfortStore.getState().reset();
    expect(useComfortStore.getState().prefs).toEqual(DEFAULT_COMFORT);
    expect((useReaderSettingsStore.getState() as unknown as { textSize: string }).textSize).toBe('large');
    const store = fs.readFileSync(path.join(__dirname, 'useComfortStore.ts'), 'utf8').replace(/\/\/[^\n]*/g, '');
    expect(store).not.toMatch(/useAppStore|i18n|ReaderSettings|supabase/);
  });

  it('age-mode compatible: comfort settings never change the age experience', () => {
    expect(sanitizeComfort({ largerControls: true, ageGroup: 'adult' } as unknown)).toEqual({ ...DEFAULT_COMFORT, largerControls: true });
    const files = ['comfort.ts', 'useComfortStore.ts', 'haptics.ts'].map((file) => fs.readFileSync(path.join(__dirname, file), 'utf8')).join('\n');
    expect(files).not.toMatch(/useAgeExperience|setAgeGroup/);
  });

  it('KG / RU / EN', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { comfort: Record<string, unknown> }).comfort;
      for (const key of ['title', 'reduceMotion', 'largerControls', 'highContrast', 'readingSettings', 'reset', 'restartNow']) expect(block[key]).toBeTruthy();
      expect(Object.keys(block.haptics as object)).toEqual(['standard', 'reduced', 'off']);
    }
  });
});
