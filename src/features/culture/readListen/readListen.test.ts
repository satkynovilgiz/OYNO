import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { cultureItemNarration, materialNarration } from '@/services/audioGuide/contentNarration';
import { resolveAudioPlan } from '@/services/audioGuide/narration';
import type { CultureItemRow, CultureMaterialRow } from '@/services/content/types';

import { activeSections, chunkSectionMap, cultureItemNarrationParts, FOLLOW_PAUSE_MS, materialNarrationParts, narrationChunks, shouldAutoScroll } from './narrationSections';

const sentence = (word: string, n: number) => Array.from({ length: n }, (_, i) => `${word} sentence number ${i + 1} is here.`).join(' ');
const item = (fields: Partial<CultureItemRow> = {}): CultureItemRow =>
  ({
    id: 'boz-uy-overview', title: 'Боз үй', origin: sentence('Origin', 4), history: sentence('History', 14), cultural_meaning: 'Short meaning.', when_used: null,
    simple_summary_kg: null, simple_summary_ru: null, simple_summary_en: null, accuracy_level: 'partially_verified', sources: [], translation: undefined, ...fields,
  }) as unknown as CultureItemRow;
const voices = [{ identifier: 'ky', language: 'ky-KG' }];

describe('Read & Listen', () => {
  it('narration parts are EXACTLY what the Audio Guide reads (same text, same chunks)', () => {
    const row = item();
    const parts = cultureItemNarrationParts(row, 'kg', 'standard');
    const plan = resolveAudioPlan({ appLanguage: 'kg', narration: cultureItemNarration(row, 'kg', 'standard'), recorded: null, ttsAvailable: true, voices });
    expect(plan.kind).toBe('tts');
    expect(narrationChunks(parts)).toEqual((plan as { chunks: string[] }).chunks);
    const material = { id: 'm', title: 'Комуз', body: sentence('Body', 5), translation: undefined } as unknown as CultureMaterialRow;
    expect(narrationChunks(materialNarrationParts(material, 'kg'))).toEqual(resolveAudioPlan({ appLanguage: 'kg', narration: materialNarration(material, 'kg'), recorded: null, ttsAvailable: true, voices }).kind === 'tts' ? (resolveAudioPlan({ appLanguage: 'kg', narration: materialNarration(material, 'kg'), recorded: null, ttsAvailable: true, voices }) as { chunks: string[] }).chunks : []);
  });

  it('TTS chunk -> the correct authored section (boundary chunks touch both)', () => {
    const parts = cultureItemNarrationParts(item(), 'kg', 'standard');
    const chunks = narrationChunks(parts);
    const map = chunkSectionMap(parts, chunks);
    expect(map).toHaveLength(chunks.length);
    expect(map[0]).toContain('origin');
    expect(map.at(-1)).toContain('cultural_meaning');
    expect(map.some((keys) => keys.includes('history') && keys.length === 1)).toBe(true);
    // Every chunk maps to at least one section, in reading order.
    const order = ['title', 'origin', 'history', 'cultural_meaning'];
    let last = 0;
    for (const keys of map) {
      expect(keys.length).toBeGreaterThan(0);
      const first = order.indexOf(keys[0]);
      expect(first).toBeGreaterThanOrEqual(last);
      last = first;
    }
  });

  it('highlights only while THIS content is really narrated by device speech', () => {
    const map = [['origin'], ['origin', 'history'], ['history']];
    expect(activeSections({ active: true, status: 'playing', chunk: 1, recorded: false }, map)).toEqual(['origin', 'history']);
    expect(activeSections({ active: true, status: 'paused', chunk: 2, recorded: false }, map)).toEqual(['history']);
    expect(activeSections({ active: false, status: 'playing', chunk: 1, recorded: false }, map)).toEqual([]);
    expect(activeSections({ active: true, status: 'finished', chunk: 2, recorded: false }, map)).toEqual([]);
    expect(activeSections({ active: true, status: 'playing', chunk: 0, recorded: false }, [['title', 'origin']])).toEqual(['origin']);
  });

  it('recorded audio without timestamps never highlights', () => {
    expect(activeSections({ active: true, status: 'playing', chunk: null, recorded: true }, [['origin']])).toEqual([]);
    expect(activeSections({ active: true, status: 'playing', chunk: 0, recorded: true }, [['origin']])).toEqual([]);
  });

  it('text that disagrees with the narration gets no highlight (never a wrong one)', () => {
    expect(chunkSectionMap([{ key: 'origin', text: 'Completely different.' }], ['Not in the text.'])).toEqual([]);
  });

  it('follow on/off; a manual scroll pauses following temporarily', () => {
    expect(shouldAutoScroll(false, null, 1000)).toBe(false);
    expect(shouldAutoScroll(true, null, 1000)).toBe(true);
    expect(shouldAutoScroll(true, 1000, 1000 + FOLLOW_PAUSE_MS - 1)).toBe(false);
    expect(shouldAutoScroll(true, 1000, 1000 + FOLLOW_PAUSE_MS)).toBe(true);
  });

  it('language: Kyrgyz-fallback text is never narrated (or highlighted) in RU/EN', () => {
    const row = item();
    const plan = resolveAudioPlan({ appLanguage: 'ru', narration: cultureItemNarration(row, 'ru', 'standard'), recorded: null, ttsAvailable: true, voices: [{ identifier: 'ru', language: 'ru-RU' }] });
    expect(plan).toEqual({ kind: 'unavailable', reason: 'noContentInLanguage' });
    const screen = fs.readFileSync(path.join(__dirname, '../CultureItemDetailScreen.tsx'), 'utf8');
    expect(screen).toMatch(/narration\.lang === i18n\.language && narration\.text \? <ReadListenControls/);
  });

  it('screen integration: reader settings kept, reduce motion respected, no autoplay, reading tracker untouched', () => {
    const screen = fs.readFileSync(path.join(__dirname, '../CultureItemDetailScreen.tsx'), 'utf8');
    expect(screen).toMatch(/animated: !reducedMotion/);
    expect(screen).toMatch(/onScrollBeginDrag=\{\(\) => \{\s*lastManualScroll\.current = Date\.now\(\);/);
    expect(screen).toMatch(/style=\{\[styles\.paragraph, isChild && styles\.paragraphChild, bodyStyle\]\}/);
    const hook = fs.readFileSync(path.join(__dirname, 'ReadListen.tsx'), 'utf8');
    expect(hook).not.toMatch(/\.start\(|\.play\(|\.resume\(|markRead|useReadingStore/);
    expect(screen).not.toMatch(/markRead\(/);
  });

  it('Audio Guide store keeps its policies (background pause, Komuz exclusion untouched)', () => {
    const store = fs.readFileSync(path.join(__dirname, '../../../services/audioGuide/useAudioGuideStore.ts'), 'utf8');
    expect(store).toMatch(/if \(state === 'background'\) get\(\)\.pause\(\)/);
    const hook = fs.readFileSync(path.join(__dirname, 'ReadListen.tsx'), 'utf8');
    expect(hook).not.toMatch(/useKomuzPlayerStore|AppState|staysActiveInBackground/);
  });

  it('audio "now reading" emphasis is distinct from a saved Highlight', () => {
    const hook = fs.readFileSync(path.join(__dirname, 'ReadListen.tsx'), 'utf8');
    expect(hook).toMatch(/borderLeftColor: colors\.primary/);
    const passage = fs.readFileSync(path.join(__dirname, '../highlights/PassageActions.tsx'), 'utf8');
    expect(passage).not.toMatch(/readListenStyles/);
  });

  it('KG / RU / EN', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { readListen: Record<string, string> }).readListen;
      for (const key of ['mode', 'follow', 'note', 'recordedNote']) expect(block[key]).toBeTruthy();
    }
  });
});
