import * as fs from 'fs';
import * as path from 'path';

import AsyncStorage from '@react-native-async-storage/async-storage';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { useReaderSettingsStore } from '@/store/useReaderSettingsStore';

import { recordPosition, resumeOffset } from '../reading/readingModel';
import { DEFAULT_READER_SETTINGS, LINE_SPACINGS, readerBodyStyle, sanitizeSettings, TEXT_SIZES } from './readerSettings';

const detail = fs.readFileSync(path.join(__dirname, '../CultureItemDetailScreen.tsx'), 'utf8');
const material = fs.readFileSync(path.join(__dirname, '../MaterialDetailScreen.tsx'), 'utf8');

describe('Reader controls', () => {
  it('fixed text size and line spacing presets', () => {
    expect(TEXT_SIZES).toEqual({ small: 0.9, default: 1, large: 1.15, xl: 1.3 });
    expect(LINE_SPACINGS).toEqual({ compact: 1.4, comfortable: 1.56, spacious: 1.8 });
    expect(readerBodyStyle(16, DEFAULT_READER_SETTINGS, false)).toEqual({ fontSize: 16, lineHeight: 25 });
    expect(readerBodyStyle(16, { textSize: 'xl', lineSpacing: 'spacious' }, false)).toEqual({ fontSize: 20.8, lineHeight: 37 });
  });

  it('child baseline preserved: Small is relative to the child size and never adult-small', () => {
    expect(readerBodyStyle(17, DEFAULT_READER_SETTINGS, true).fontSize).toBe(17);
    expect(readerBodyStyle(17, { textSize: 'small', lineSpacing: 'comfortable' }, true).fontSize).toBe(16);
    expect(readerBodyStyle(15, DEFAULT_READER_SETTINGS, true).fontSize).toBe(15);
    expect(readerBodyStyle(17, { textSize: 'small', lineSpacing: 'comfortable' }, false).fontSize).toBe(15.3);
  });

  it('persists, sanitizes and resets (device-level, not per account)', async () => {
    await AsyncStorage.clear();
    useReaderSettingsStore.setState({ ...DEFAULT_READER_SETTINGS, isLoaded: false });
    await useReaderSettingsStore.getState().load();
    useReaderSettingsStore.getState().update({ textSize: 'large', lineSpacing: 'spacious', focusMode: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    useReaderSettingsStore.setState({ ...DEFAULT_READER_SETTINGS, isLoaded: false });
    await useReaderSettingsStore.getState().load();
    expect(useReaderSettingsStore.getState()).toMatchObject({ textSize: 'large', lineSpacing: 'spacious', focusMode: true });
    useReaderSettingsStore.getState().reset();
    expect(useReaderSettingsStore.getState()).toMatchObject(DEFAULT_READER_SETTINGS);
    expect(sanitizeSettings({ textSize: 'giant', lineSpacing: 7, focusMode: 'yes' })).toEqual(DEFAULT_READER_SETTINGS);
    expect(fs.readFileSync(path.join(__dirname, '../../../store/useReaderSettingsStore.ts'), 'utf8')).not.toMatch(/owner|useAuthStore/);
  });

  it('focus mode never hides Sources, verification or Report', () => {
    expect(detail).toMatch(/<SourcesAndNotes contentType="culture_item" level=\{item\.accuracy_level\} sources=\{item\.sources\} \/>/);
    expect(detail).toMatch(/<ReportIssueLink contentType="culture_item"/);
    expect(detail).toMatch(/hasRemainingGallery && !reader\.focusMode/);
    expect(detail).toMatch(/reader\.focusMode \? null : <RelatedItemsRail/);
    expect(detail).not.toMatch(/focusMode[^\n]*SourcesAndNotes|focusMode[^\n]*ReportIssueLink/);
    expect(material).toMatch(/<SourcesAndNotes contentType="culture_material"/);
  });

  it('reading progress stays a normalized ratio; a size change keeps it (no reset)', () => {
    const data = recordPosition({}, 'culture_item', 'a', 0.55);
    // Same ratio on a longer (larger-text) layout lands proportionally.
    expect(resumeOffset(data['culture_item:a'].progress, 3000, 1000)).toBe(1100);
    expect(resumeOffset(data['culture_item:a'].progress, 5000, 1000)).toBe(2200);
    for (const screen of [detail, material]) {
      expect(screen).toMatch(/reading\.keepPosition\(\);/);
      expect(screen).not.toMatch(/useReadingStore\.getState\(\)\.reset/);
    }
  });

  it('respects Reduce Motion and system font scaling', () => {
    const controls = fs.readFileSync(path.join(__dirname, 'ReaderControls.tsx'), 'utf8');
    expect(controls).toMatch(/animationType=\{reducedMotion \? 'none' : 'slide'\}/);
    expect(controls + detail + material).not.toMatch(/allowFontScaling=\{false\}/);
  });

  it('KG / RU / EN strings', () => {
    for (const dict of [kg, ru, en]) {
      const block = (dict as unknown as { readerSettings: Record<string, Record<string, string> | string> }).readerSettings;
      expect(block.title && block.focus && block.reset).toBeTruthy();
      const size = block.size as Record<string, string>;
      const spacing = block.spacing as Record<string, string>;
      for (const key of ['label', 'small', 'default', 'large', 'xl']) expect(size[key]).toBeTruthy();
      for (const key of ['label', 'compact', 'comfortable', 'spacious']) expect(spacing[key]).toBeTruthy();
    }
  });
});
