import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';

import type { JournalEntry } from '../journalModel';
import {
  bookAnalytics,
  bookEntries,
  bookFileName,
  buildBookHtml,
  canGenerate,
  cleanBookTitle,
  dateRange,
  escapeHtml,
  isEmbeddableImage,
  MAX_BOOK_ENTRIES,
  MIN_BOOK_ENTRIES,
  sortForBook,
  toggleBookSelection,
  validSelection,
} from './memoryBookModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));
jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn(() => null) }));

const ROOT = path.join(__dirname, '../../../..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const entry = (id: string, date: string, extra: Partial<JournalEntry> = {}): JournalEntry => ({
  id,
  title: `Memory ${id}`,
  note: '',
  date,
  photo: null,
  link: null,
  createdAt: '2026-10-04T00:00:00Z',
  updatedAt: '2026-10-04T00:00:00Z',
  deletedAt: null,
  ...extra,
});
const html = (pages: Parameters<typeof buildBookHtml>[0]['pages'], layout: 'classic' | 'photo' = 'classic') =>
  buildBookHtml({ title: 'My OYNO Memory Book', subtitle: null, layout, pages, labels: { untitled: 'Untitled', madeWith: 'Made with OYNO' }, language: 'en' });

describe('Memory Book - selection', () => {
  const entries = Array.from({ length: 25 }, (_, i) => entry(`e${i}`, `2026-0${(i % 9) + 1}-1${i % 10}`));

  it('min 3 / max 20', () => {
    expect(MIN_BOOK_ENTRIES).toBe(3);
    expect(MAX_BOOK_ENTRIES).toBe(20);
    expect(canGenerate(entries, ['e0', 'e1'])).toBe(false);
    expect(canGenerate(entries, ['e0', 'e1', 'e2'])).toBe(true);
    let selected: string[] = [];
    for (const item of entries) selected = toggleBookSelection(selected, item.id);
    expect(selected).toHaveLength(20);
    expect(toggleBookSelection(selected, 'e0')).toHaveLength(19);
  });

  it('deleted memories can never be selected or exported (also when deleted after selection)', () => {
    const list = [entry('a', '2026-01-01'), entry('b', '2026-01-02'), entry('c', '2026-01-03', { deletedAt: '2026-10-04T00:00:00Z' }), entry('d', '2026-01-04')];
    expect(validSelection(list, ['a', 'b', 'c', 'd'])).toEqual(['a', 'b', 'd']);
    expect(bookEntries(list, ['a', 'b', 'c', 'd'], 'oldest').map((e) => e.id)).toEqual(['a', 'b', 'd']);
    expect(canGenerate(list, ['a', 'b', 'c'])).toBe(false);
    const screen = read('src/features/journal/book/MemoryBookScreen.tsx');
    expect(screen).toContain('const latest = useJournalStore.getState().entries;');
  });

  it('owner isolation: selection resets on account change; generation aborts if the owner changes', () => {
    const screen = read('src/features/journal/book/MemoryBookScreen.tsx');
    expect(screen).toMatch(/useEffect\(\(\) => \{\s*setSelected\(\[\]\);\s*\}, \[owner\]\);/);
    expect(screen).toContain('if (currentPhotoOwner() !== photoOwner) return;');
    // Entries come only from the current account's Journal store (cleared on sign-out).
    expect(screen).toContain('useJournalStore((state) => state.entries)');
  });

  it('date ordering by JournalEntry.date (not createdAt), both directions', () => {
    const list = [entry('x', '2026-05-01', { createdAt: '2020-01-01T00:00:00Z' }), entry('y', '2024-02-01', { createdAt: '2026-10-01T00:00:00Z' }), entry('z', '2025-07-15')];
    expect(sortForBook(list, 'oldest').map((e) => e.id)).toEqual(['y', 'z', 'x']);
    expect(sortForBook(list, 'newest').map((e) => e.id)).toEqual(['x', 'z', 'y']);
    expect(dateRange(list)).toEqual({ from: '2024-02-01', to: '2026-05-01' });
  });

  it('title default and cleaning; filename', () => {
    expect(cleanBookTitle('  ', 'My OYNO Memory Book')).toBe('My OYNO Memory Book');
    expect(cleanBookTitle('  Summer\n 2026 ', 'x')).toBe('Summer 2026');
    expect(bookFileName('2026-10-04')).toBe('OYNO-Memory-Book-2026-10-04.pdf');
    expect(en.memoryBook.defaultTitle).toBe('My OYNO Memory Book');
  });
});

describe('Memory Book - document', () => {
  it('text toggle: OFF by default, and the note is absent when off', () => {
    expect(read('src/features/journal/book/MemoryBookScreen.tsx')).toContain('const [includeText, setIncludeText] = useState(false);');
    const doc = html([{ title: 'Day', dateLabel: 'October 4', note: null, image: null }]);
    expect(doc).not.toContain('class="note"');
  });

  it('notes preserved exactly (escaped, never trimmed or rewritten); long notes flow onto further pages', () => {
    const note = 'Line one\n\n  Indented <b>not html</b> & "quotes"\n' + 'Long. '.repeat(3000);
    const doc = html([{ title: 'Day', dateLabel: 'October 4', note, image: null }]);
    expect(doc).toContain(escapeHtml(note));
    expect(doc).toContain('white-space: pre-wrap');
    expect(doc).not.toContain('<b>not html</b>');
    expect(doc).toMatch(/\.memory \{ page-break-before: always/);
    expect(doc).not.toMatch(/max-height:[^;]*note|text-overflow|line-clamp/);
  });

  it('A4 portrait, real text, OYNO styling', () => {
    const doc = html([{ title: 'Day', dateLabel: 'October 4', note: 'Hello', image: null }]);
    expect(doc).toContain('@page { size: A4 portrait; margin: 18mm 16mm; }');
    expect(doc).toContain('<h2>Day</h2>');
    expect(doc).toContain('#F3E5C9');
  });

  it('missing photo: the memory still prints without it; never a file path or URL in the PDF', () => {
    const doc = html([
      { title: 'With', dateLabel: 'a', note: null, image: 'data:image/jpeg;base64,AAAA' },
      { title: 'Path', dateLabel: 'b', note: null, image: 'file:///var/mobile/journal/u1/e1-v1.jpg' },
      { title: 'Remote', dateLabel: 'c', note: null, image: 'u1/e1/v1.jpg' },
      { title: 'None', dateLabel: 'd', note: null, image: null },
    ]);
    expect((doc.match(/<img /g) ?? []).length).toBe(1);
    expect(doc).not.toMatch(/file:\/\/|journal\/u1|u1\/e1|https?:\/\//);
    for (const title of ['With', 'Path', 'Remote', 'None']) expect(doc).toContain(`<h2>${title}</h2>`);
    expect(isEmbeddableImage('data:image/png;base64,iVBOR=')).toBe(true);
    expect(isEmbeddableImage('data:text/html;base64,AAAA')).toBe(false);
  });

  it('photo failures are counted and reported, not fatal', () => {
    const screen = read('src/features/journal/book/MemoryBookScreen.tsx');
    expect(screen).toContain('if (entry.photo && !image) missingPhotos += 1;');
    expect(screen).toContain("showToast(t('memoryBook.photosMissing', { count: missingPhotos }))");
    const service = read('src/features/journal/book/memoryBookService.ts');
    expect(service).toMatch(/catch \{\s*return null;\s*\}/);
    expect(service).toContain('downloadPhoto(photo.remotePath');
  });
});

describe('Memory Book - platform, temp files, privacy', () => {
  it('native unavailable -> honest unsupported (web, or a build without expo-print)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { memoryBookSupported } = require('./memoryBookService') as typeof import('./memoryBookService');
    expect(memoryBookSupported()).toBe(false);
    const screen = read('src/features/journal/book/MemoryBookScreen.tsx');
    expect(screen).toContain("{!supported ? (");
    expect(screen).toContain("t('memoryBook.unsupported')");
  });

  it('temp cleanup: printed + renamed PDFs are deleted in finally (share, cancel or failure)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { cleanupTemps } = require('./memoryBookService') as typeof import('./memoryBookService');
    const deleted: string[] = [];
    const file = (name: string, exists = true) => ({ exists, delete: () => deleted.push(name) });
    cleanupTemps([file('printed'), file('named'), file('gone', false), { exists: true, delete: () => { throw new Error('busy'); } }]);
    expect(deleted).toEqual(['printed', 'named']);
    const service = read('src/features/journal/book/memoryBookService.ts');
    expect(service).toMatch(/\} finally \{\s*cleanupTemps\(temps\);/);
    expect(service.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')).not.toMatch(/supabase\.storage|upload/i);
  });

  it('privacy warning before generating with text or photos', () => {
    const screen = read('src/features/journal/book/MemoryBookScreen.tsx');
    expect(screen).toContain('onPress={() => (includeText || hasPhotos ? setConfirm(true) : void generate())}');
    expect(en.memoryBook.privacyMessage).toMatch(/^This book may contain private Journal memories\./);
  });

  it('analytics: counts and switches only', () => {
    expect(bookAnalytics(6, 'photo', true)).toEqual({ entry_count: 6, layout: 'photo', included_text: true });
    const screen = read('src/features/journal/book/MemoryBookScreen.tsx');
    for (const call of screen.match(/track\([^)]*\)?\)/g) ?? []) expect(call).toMatch(/journal_memory_book_started|journal_memory_book_created', bookAnalytics\(book\.length, layout, includeText\)/);
  });

  it('accessibility: "October 4 memory, selected."', () => {
    expect(`${en.memoryBook.memoryA11y.replace('{{date}}', 'October 4')}, ${en.memoryBook.selected}`).toBe('October 4 memory, selected');
    expect(read('src/features/journal/book/MemoryBookScreen.tsx')).toContain('accessibilityRole="checkbox"');
  });

  it('route, entry, dependency and KG/RU/EN', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/app/journal/book.tsx'))).toBe(true);
    expect(read('src/features/journal/JournalScreen.tsx')).toContain("router.push('/journal/book' as never)");
    expect(JSON.parse(read('package.json')).dependencies['expo-print']).toMatch(/^~57\./);
    for (const locale of [kg, ru, en]) for (const key of ['entry', 'defaultTitle', 'includeText', 'privacyMessage', 'unsupported', 'counter'] as const) expect(locale.memoryBook[key]).toBeTruthy();
  });
});
