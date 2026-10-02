import * as fs from 'fs';
import * as path from 'path';

import AsyncStorage from '@react-native-async-storage/async-storage';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { ownerHighlights, useHighlightsStore } from '@/store/useHighlightsStore';

import { EXCERPT_MAX, highlightEventProps, highlightId, mergeHighlights, NOTE_MAX, removeHighlight, savePassage, searchHighlights, setNote, sortedHighlights, sourceUpdated, validateNote } from './highlightsModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 2, 10, minutes));
const passage = { contentType: 'culture_item' as const, contentId: 'boz-uy-tunduk', sectionKey: 'cultural_meaning', language: 'kg', title: 'Түндүк', text: 'Боз үйдүн чатырынын жогорку бөлүгү.' };
const source = (file: string) => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('Highlights - model', () => {
  it('save passage stores a snapshot of the section only', () => {
    const { data, highlight, created } = savePassage({}, passage, at(0));
    expect(created).toBe(true);
    expect(highlight).toMatchObject({ id: 'culture_item:boz-uy-tunduk:cultural_meaning:kg', excerptSnapshot: passage.text, titleSnapshot: 'Түндүк', note: null });
    expect(Object.keys(data)).toHaveLength(1);
    expect(savePassage({}, { ...passage, text: 'а'.repeat(5000) }, at(0)).highlight.excerptSnapshot.length).toBe(EXCERPT_MAX + 1);
  });

  it('the same section + language is never duplicated', () => {
    const first = savePassage({}, passage, at(0));
    const again = savePassage(first.data, passage, at(5));
    expect(again.created).toBe(false);
    expect(again.data).toBe(first.data);
    // Another language is a different saved passage (kept in its own words).
    expect(savePassage(first.data, { ...passage, language: 'ru', text: 'Верх крыши.' }, at(5)).created).toBe(true);
  });

  it('add / edit / remove note; removing the note keeps the highlight', () => {
    const { data, highlight } = savePassage({}, passage, at(0));
    const withNote = setNote(data, highlight.id, '  Ask my dad about this tradition. ', at(1));
    expect(withNote[highlight.id].note).toBe('Ask my dad about this tradition.');
    expect(setNote(withNote, highlight.id, 'Edited', at(2))[highlight.id].note).toBe('Edited');
    const removed = setNote(withNote, highlight.id, '', at(3));
    expect(removed[highlight.id]).toBeDefined();
    expect(removed[highlight.id].note).toBeNull();
    expect(validateNote('x'.repeat(NOTE_MAX + 1))).toBe('tooLong');
    expect(setNote(data, highlight.id, 'x'.repeat(NOTE_MAX + 1))).toBe(data);
  });

  it('remove highlight touches only that highlight - not Saved, reading progress or the Journal', () => {
    const { data, highlight } = savePassage({}, passage, at(0));
    expect(removeHighlight(data, highlight.id)).toEqual({});
    for (const file of ['highlightsModel.ts', 'useHighlights.ts', '../../../store/useHighlightsStore.ts', 'HighlightsScreen.tsx', 'PassageActions.tsx']) {
      const code = source(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code).not.toMatch(/useFavoritesStore|toggleFavorite|useReadingStore|useJournalStore/);
    }
  });

  it('language snapshot preserved; "Source updated" only when reliably detectable', () => {
    const { highlight } = savePassage({}, passage, at(0));
    expect(sourceUpdated(highlight, { language: 'kg', text: passage.text })).toBe(false);
    expect(sourceUpdated(highlight, { language: 'kg', text: 'Жаңы текст.' })).toBe(true);
    // Different language or unknown -> never claimed.
    expect(sourceUpdated(highlight, { language: 'ru', text: 'Другое.' })).toBe(false);
    expect(sourceUpdated(highlight, null)).toBe(false);
    expect(highlight.language).toBe('kg');
  });

  it('missing source: the highlight stays readable; Open source is hidden (never a crash)', () => {
    const screen = source('HighlightsScreen.tsx');
    expect(screen).toMatch(/\{live \? <Action label=\{t\('highlights\.openSource'\)\}/);
    expect(screen).toMatch(/unavailable \? ` · \$\{t\('highlights\.sourceUnavailable'\)\}`/);
  });

  it('private local search over title, excerpt and note; newest first', () => {
    let data = savePassage({}, passage, at(0)).data;
    data = savePassage(data, { ...passage, contentId: 'horse-eer', sectionKey: 'history', title: 'Ээр', text: 'Ээрди жыгачтан чабуу.' }, at(1)).data;
    data = setNote(data, highlightId('culture_item', 'horse-eer', 'history', 'kg'), 'ask grandpa');
    const list = sortedHighlights(data);
    expect(list.map((entry) => entry.contentId)).toEqual(['horse-eer', 'boz-uy-tunduk']);
    expect(searchHighlights(list, 'grandpa').map((entry) => entry.contentId)).toEqual(['horse-eer']);
    expect(searchHighlights(list, 'түндүк').map((entry) => entry.contentId)).toEqual(['boz-uy-tunduk']);
    // Not part of Global Search.
    const globalSearch = fs.readFileSync(path.join(__dirname, '../../../services/search/globalSearch.ts'), 'utf8');
    expect(globalSearch).not.toMatch(/useHighlightsStore|highlightsModel|ContentHighlight/);
  });

  it('analytics carry only content type/id and section key - never note or excerpt', () => {
    const { highlight } = savePassage({}, passage, at(0));
    expect(highlightEventProps({ ...highlight, note: 'secret' } as never)).toEqual({ content_type: 'culture_item', content_id: 'boz-uy-tunduk', section_key: 'cultural_meaning' });
    for (const call of source('useHighlights.ts').match(/track\([^)]*\)/g) ?? []) expect(call).toMatch(/highlightEventProps/);
  });
});

describe('Highlights - storage and accounts', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useHighlightsStore.setState({ isLoaded: false, saved: {} });
  });

  it('guest highlights persist; guest -> account adoption; A never seen by B', async () => {
    await useHighlightsStore.getState().load();
    useHighlightsStore.getState().save('guest', passage);
    await new Promise((resolve) => setTimeout(resolve, 0));
    useHighlightsStore.setState({ isLoaded: false, saved: {} });
    await useHighlightsStore.getState().load();
    expect(Object.keys(ownerHighlights(useHighlightsStore.getState().saved, 'guest'))).toHaveLength(1);
    useHighlightsStore.getState().adoptGuest('user-a');
    const saved = useHighlightsStore.getState().saved;
    expect(Object.keys(ownerHighlights(saved, 'user-a'))).toHaveLength(1);
    expect(ownerHighlights(saved, 'guest')).toEqual({});
    expect(ownerHighlights(saved, 'user-b')).toEqual({});
    expect(mergeHighlights({}, ownerHighlights(saved, 'user-a'))).toEqual(ownerHighlights(saved, 'user-a'));
  });

  it('KG / RU / EN strings', () => {
    for (const dict of [kg, ru, en]) {
      const block = (dict as unknown as { highlights: Record<string, string> }).highlights;
      for (const key of ['savePassage', 'saved', 'title', 'addNote', 'editNote', 'removeNote', 'removeHighlight', 'openSource', 'savedIn', 'sourceUnavailable', 'empty']) expect(block[key]).toBeTruthy();
    }
  });
});
