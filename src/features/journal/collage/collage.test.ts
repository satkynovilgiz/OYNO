import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';

import type { JournalEntry } from '../journalModel';
import { canCreate, canOfferCollage, cleanCaption, collageItems, collagePresentation, MAX_SELECTED, NOTE_EXCERPT_MAX, toggleSelection } from './collageModel';

const entry = (id: string, fields: Partial<JournalEntry> = {}): JournalEntry => ({
  id,
  title: `Memory ${id}`,
  note: 'A long private note about the day at Issyk-Kul with my family, the water, the mountains and everything we saw along the road there.',
  date: '2026-07-14',
  photo: null,
  link: null,
  createdAt: '2026-09-30T10:00:00.000Z',
  updatedAt: '2026-09-30T10:00:00.000Z',
  deletedAt: null,
  ...fields,
});

describe('Journal Memory Collage', () => {
  it('selection: 2-6, no duplicates, never above the cap', () => {
    let selected: string[] = [];
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) selected = toggleSelection(selected, id);
    expect(selected).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(selected.length).toBe(MAX_SELECTED);
    expect(toggleSelection(['a'], 'a')).toEqual([]);
    expect(canCreate(['a'])).toBe(false);
    expect(canCreate(['a', 'b'])).toBe(true);
    expect(canCreate(['a', 'a'])).toBe(false);
    expect(canCreate(['a', 'b', 'c', 'd', 'e'], collagePresentation('child').maxSelected)).toBe(false);
  });

  it('uses the memory date (not createdAt) and the person’s own photo only', () => {
    const items = collageItems([entry('a', { photo: { localUri: 'file:///journal/a.jpg', remotePath: null } }), entry('b')], ['a', 'b'], { includeNotes: false });
    expect(items[0]).toMatchObject({ memoryDate: '2026-07-14', photoUri: 'file:///journal/a.jpg', photoState: 'photo' });
    expect(items[1]).toMatchObject({ photoState: 'none', photoUri: null });
    const view = fs.readFileSync(path.join(__dirname, 'CollageView.tsx'), 'utf8');
    expect(view).not.toMatch(/cultureItemImages|natureSiteImages|linkArtwork|require\(/);
  });

  it('notes are off by default; when on, only a short excerpt', () => {
    expect(collageItems([entry('a'), entry('b')], ['a', 'b'], { includeNotes: false }).every((item) => item.excerpt === null)).toBe(true);
    const withNotes = collageItems([entry('a'), entry('b')], ['a', 'b'], { includeNotes: true });
    expect(withNotes[0].excerpt!.length).toBeLessThanOrEqual(NOTE_EXCERPT_MAX);
    expect(withNotes[0].excerpt!.endsWith('…')).toBe(true);
    const screen = fs.readFileSync(path.join(__dirname, 'JournalCollageScreen.tsx'), 'utf8');
    expect(screen).toMatch(/useState\(false\);\s*\n\s*\n?\s*useEffect|const \[includeNotes, setIncludeNotes\] = useState\(false\)/);
  });

  it('a photo whose file is not on this device is shown as unavailable - never replaced', () => {
    const items = collageItems([entry('a', { photo: { localUri: null, remotePath: 'u/a/v.jpg' } }), entry('b')], ['a', 'b'], { includeNotes: false });
    expect(items[0]).toMatchObject({ photoState: 'missing', photoUri: null });
  });

  it('deleted memories are not eligible; the entry point needs at least 2', () => {
    expect(canOfferCollage([entry('a'), entry('b', { deletedAt: '2026-10-01T00:00:00Z' })])).toBe(false);
    expect(canOfferCollage([entry('a'), entry('b')])).toBe(true);
    expect(collageItems([entry('a'), entry('b', { deletedAt: 'x' })], ['a', 'b'], { includeNotes: false }).map((item) => item.id)).toEqual(['a']);
  });

  it('caption max 80, trimmed', () => {
    expect(cleanCaption('  Issyk-Kul   2026 ')).toBe('Issyk-Kul 2026');
    expect(cleanCaption('x'.repeat(200)).length).toBe(80);
  });

  it('share happens only from an explicit preview; nothing stored, no Journal entry changed', () => {
    const screen = fs.readFileSync(path.join(__dirname, 'JournalCollageScreen.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    expect(screen).toMatch(/onPress=\{onShare\}/);
    expect(screen).toMatch(/useShareCard\(\)/);
    expect(screen).not.toMatch(/\.getState\(\)\.(save|remove|update|replaceAll|delete)/);
    expect(screen).not.toMatch(/AsyncStorage|supabase|upload/);
    const entries = [entry('a'), entry('b')];
    const before = JSON.stringify(entries);
    collageItems(entries, ['a', 'b'], { includeNotes: true });
    expect(JSON.stringify(entries)).toBe(before);
  });

  it('analytics carry only the selected count', () => {
    const screen = fs.readFileSync(path.join(__dirname, 'JournalCollageScreen.tsx'), 'utf8');
    for (const call of screen.match(/track\([^)]*\)/g) ?? []) expect(call).toBe("track('journal_collage_created', { selected_count: items.length })");
  });

  it('account isolation: reads the account-bound Journal store (cleared on sign-out)', () => {
    const screen = fs.readFileSync(path.join(__dirname, 'JournalCollageScreen.tsx'), 'utf8');
    expect(screen).toMatch(/useJournalStore\(\(state\) => state\.entries\)/);
  });

  it('age: same memories; children get the simple 2-4 grid', () => {
    expect(collagePresentation('child')).toMatchObject({ maxSelected: 4, layouts: ['grid'] });
    expect(collagePresentation('preteen').defaultLayout).toBe('scrapbook');
    expect(collagePresentation('adult')).toMatchObject({ defaultLayout: 'story', editorial: true });
  });

  it('KG / RU / EN', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { journalCollage: Record<string, unknown> }).journalCollage;
      for (const key of ['create', 'title', 'includeNotes', 'photoUnavailable', 'share', 'caption']) expect(block[key]).toBeTruthy();
      expect(Object.keys(block.layouts as object)).toEqual(['grid', 'scrapbook', 'story']);
    }
  });
});
