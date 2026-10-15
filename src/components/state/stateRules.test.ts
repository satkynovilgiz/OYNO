import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';

import { resolveScreenState, SLOW_AFTER_MS, storeInputs } from './stateRules';

const ROOT = path.join(__dirname, '../../..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('screen states - one rule', () => {
  it('distinguishes loading, failed, unavailable, not found, empty and ready', () => {
    expect(resolveScreenState({ loading: true, failed: false })).toBe('loading');
    expect(resolveScreenState({ loading: false, failed: true })).toBe('error');
    expect(resolveScreenState({ loading: false, failed: false, unavailable: true })).toBe('unavailable');
    expect(resolveScreenState({ loading: false, failed: false, missing: true })).toBe('notFound');
    expect(resolveScreenState({ loading: false, failed: false, empty: true })).toBe('empty');
    expect(resolveScreenState({ loading: false, failed: false })).toBe('ready');
  });
  it('a failure is never "not found" or "empty"; loaded content stays when a refresh fails', () => {
    expect(resolveScreenState({ loading: false, failed: true, missing: true })).toBe('error');
    expect(resolveScreenState({ loading: false, failed: true, empty: true })).toBe('error');
    expect(resolveScreenState({ loading: false, failed: true, hasContent: true })).toBe('ready');
    expect(resolveScreenState({ loading: true, failed: false, hasContent: true })).toBe('ready');
  });
  it('store statuses map onto it (idle counts as loading, never as empty)', () => {
    expect(storeInputs('idle')).toEqual({ loading: true, failed: false });
    expect(storeInputs('error')).toEqual({ loading: false, failed: true });
    expect(resolveScreenState({ ...storeInputs('ready'), empty: true })).toBe('empty');
  });
  it('no endless spinner: loading explains itself after a fixed time and can retry', () => {
    expect(SLOW_AFTER_MS).toBeLessThanOrEqual(10_000);
    const component = read('src/components/state/ScreenState.tsx');
    expect(component).toMatch(/setTimeout\(\(\) => setSlow\(true\), SLOW_AFTER_MS\)/);
  });
});

describe('screen states - audited screens', () => {
  it('article and material routes use the shared gate (no bare spinner, failure not shown as not found)', () => {
    for (const file of ['src/app/culture/item/[itemId]/index.tsx', 'src/app/culture/material/[materialId]/index.tsx']) {
      const route = read(file);
      expect(route).toContain('<ContentQueryGate');
      expect(route).not.toMatch(/ActivityIndicator|NotFoundState message=\{error/);
    }
  });
  it('records: scrapbook detail, questions and custom motifs offer Retry on failure; scrapbook loading is never blank', () => {
    const scrapbook = read('src/features/scrapbook/ScrapbookScreens.tsx');
    expect(scrapbook).not.toMatch(/if \(status === 'error'\) return <NotFoundState/);
    expect(scrapbook).not.toMatch(/if \(status !== 'ready'\) return <View style=\{styles\.root\} \/>/);
    expect(read('src/features/questions/QuestionsScreens.tsx')).toMatch(/kind="error"[^\n]*retryLoad/);
    expect(read('src/features/culture/oymo/customMotif/CustomMotifScreens.tsx')).toMatch(/kind="error"[^\n]*retryLoad/);
  });
  it('Creator: failed saved designs are an error with Retry, not an empty gallery; canvas edits are not involved', () => {
    const creator = read('src/features/culture/oymo/OymoCreatorScreen.tsx');
    expect(creator).toMatch(/creationsQuery\.isError && !creations \? \(\s*<SectionError/);
    expect(creator).toMatch(/\{creations \? <SavedPatternsGallery/);
  });
  it('Shelf: offline is "unavailable", not an endless "loading"', () => {
    expect(read('src/features/shelf/useShelfSources.ts')).toMatch(/designs\.fetchStatus === 'paused'\s*\?\s*\{ status: 'unavailable', reason: 'offline' \}/);
  });
  it('messages exist in KG / RU / EN', () => {
    for (const dict of [en, ru, kg]) {
      const states = (dict as unknown as { states: Record<string, string> }).states;
      for (const key of ['slow', 'offlineBody', 'reconnectedBody', 'openDownloads', 'errorBody', 'loadingArticle', 'articleError', 'recordsErrorBody', 'designsError', 'designOpenError', 'loadingDesigns', 'designMissing', 'shelfOffline']) expect([key, !!states[key]?.trim()]).toEqual([key, true]);
    }
  });
});
