import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { readingRules } from '@/services/sync/privateSync/domains';

import { COMPLETION_THRESHOLD, recordPosition, recordSection, type ReadingData } from '../../reading/readingModel';
import { currentSectionAt, jumpOffset, MIN_TOC_SECTIONS, resumeSection, sectionA11yLabel, tableOfContents, type NavSection } from './sectionNavigator';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const ROOT = path.join(__dirname, '../../../../..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const S = (keys: string[]): NavSection[] => keys.map((key) => ({ key, label: key.replace(/_/g, ' ') }));
const FIVE = S(['origin', 'history', 'cultural_meaning', 'traditional_method', 'modern_status']);
const words = { sectionOf: (position: number, total: number) => `section ${position} of ${total}`, youAreHere: 'You are here' };

describe('Table of Contents rules', () => {
  it('short article hides the TOC (fewer than 3 meaningful sections)', () => {
    expect(MIN_TOC_SECTIONS).toBe(3);
    expect(tableOfContents(S(['history', 'origin']))).toBeNull();
    expect(tableOfContents([])).toBeNull();
    expect(tableOfContents([...S(['history', 'origin']), { key: 'x', label: '   ' }])).toBeNull();
    expect(tableOfContents(S(['origin', 'history', 'cultural_meaning']))?.length).toBe(3);
  });

  it('section ordering is the rendered order; missing sections are simply absent', () => {
    expect(tableOfContents(FIVE)!.map((section) => section.key)).toEqual(['origin', 'history', 'cultural_meaning', 'traditional_method', 'modern_status']);
    // The screen builds sections from filledFields, i.e. only fields that have text.
    const screen = read('src/features/culture/CultureItemDetailScreen.tsx');
    expect(screen).toMatch(/const navSections: NavSection\[\] = simpleSummary \? \[\] : filledFields\.map/);
    expect(screen).toMatch(/const filledFields = DETAIL_FIELDS\.filter\(\(field\) => !!item\[field\.key\]\)/);
  });

  it('jump target: measured section top minus padding, never negative, never a stored pixel', () => {
    expect(jumpOffset(900)).toBe(876);
    expect(jumpOffset(10)).toBe(0);
    const screen = read('src/features/culture/CultureItemDetailScreen.tsx');
    expect(screen).toContain('reading.jumpTo(jumpOffset(top), !reducedMotion)');
  });

  it('current section: the last heading above the reading line', () => {
    const tops = [
      { key: 'origin', top: 400 },
      { key: 'history', top: 900 },
      { key: 'cultural_meaning', top: 1500 },
    ];
    expect(currentSectionAt(tops, 0, 800)).toBeNull();
    expect(currentSectionAt(tops, 200, 800)).toBe('origin');
    expect(currentSectionAt(tops, 700, 800)).toBe('history');
    expect(currentSectionAt(tops, 5000, 800)).toBe('cultural_meaning');
    expect(currentSectionAt([], 100, 800)).toBeNull();
  });

  it('accessibility: "History, section 2 of 5" and the current-section state', () => {
    expect(sectionA11yLabel({ key: 'history', label: 'History' }, 2, 5, false, words)).toBe('History, section 2 of 5');
    expect(sectionA11yLabel({ key: 'history', label: 'History' }, 2, 5, true, words)).toBe('History, section 2 of 5, You are here');
    for (const locale of [kg, ru, en]) for (const key of ['contents', 'sectionOf', 'youAreHere'] as const) expect(locale.readerNavigator[key]).toBeTruthy();
    expect(en.readerNavigator.sectionOf.replace('{{position}}', '2').replace('{{total}}', '5')).toBe('section 2 of 5');
    const sheet = read('src/features/culture/reader/navigator/ContentsSheet.tsx');
    expect(sheet).toContain('accessibilityState={{ selected: here }}');
  });
});

describe('Resume section (alongside the existing reading record)', () => {
  const at = new Date('2026-10-04T10:00:00Z');
  const started: ReadingData = recordPosition({}, 'culture_item', 'boz-uy-tunduk', 0.3, at);

  it('stores only a section KEY on an existing record; never creates history, never changes progress', () => {
    expect(recordSection({}, 'culture_item', 'boz-uy-tunduk', 'history')).toEqual({});
    const next = recordSection(started, 'culture_item', 'boz-uy-tunduk', 'history');
    const record = next['culture_item:boz-uy-tunduk'];
    expect(record.lastSectionKey).toBe('history');
    expect({ ...record, lastSectionKey: undefined }).toEqual({ ...started['culture_item:boz-uy-tunduk'], lastSectionKey: undefined });
    expect(recordSection(next, 'culture_item', 'boz-uy-tunduk', 'history')).toBe(next);
    expect(recordSection(started, 'culture_item', 'boz-uy-tunduk', 'Bad Key!')).toBe(started);
    // Later scroll records keep the section.
    expect(recordPosition(next, 'culture_item', 'boz-uy-tunduk', 0.4, at)['culture_item:boz-uy-tunduk'].lastSectionKey).toBe('history');
  });

  it('resume uses a section only while it still exists (removed stale section -> ratio fallback, no crash)', () => {
    expect(resumeSection('history', FIVE)).toBe('history');
    expect(resumeSection('regional_notes', FIVE)).toBeNull();
    expect(resumeSection(undefined, FIVE)).toBeNull();
    expect(resumeSection('history', [])).toBeNull();
    const tracker = read('src/features/culture/reading/useReadingTracker.ts');
    expect(tracker).toMatch(/const offset = record\.lastSectionKey && sectionOffset \? sectionOffset\(record\.lastSectionKey\) : null;\s*if \(offset !== null\)/);
    expect(tracker).toContain('pendingResume.current = record.progress;');
  });

  it('sync accepts the optional key, drops a malformed one, keeps older records valid', () => {
    const base = { contentType: 'culture_item', contentId: 'x', progress: 0.3, furthest: 0.4, lastReadAt: at.toISOString(), completedAt: null };
    expect(readingRules.validate(base)).toEqual(base);
    expect(readingRules.validate({ ...base, lastSectionKey: 'history' })?.lastSectionKey).toBe('history');
    expect(readingRules.validate({ ...base, lastSectionKey: '<script>' })).toEqual(base);
  });
});

describe('Jumping is not reading', () => {
  const tracker = read('src/features/culture/reading/useReadingTracker.ts');

  it('no completion on jump: a jump suppresses recording until the next hand scroll', () => {
    expect(tracker).toMatch(/jumpTo: \(offsetY, animated\) => \{\s*jumped\.current = true;/);
    const onScroll = tracker.slice(tracker.indexOf('const onScroll'), tracker.indexOf('return {'));
    expect(onScroll.indexOf('if (jumped.current) return;')).toBeGreaterThan(-1);
    expect(onScroll.indexOf('if (jumped.current) return;')).toBeLessThan(onScroll.indexOf('useReadingStore.getState().record('));
    expect(tracker).toMatch(/onScrollBeginDrag: \(\) => \{\s*jumped\.current = false;/);
    expect(tracker).toMatch(/noteSection: \(sectionKey\) => \{\s*if \(jumped\.current/);
    // Sanity: the rule that WOULD complete an article on a deep scroll still exists for real reading.
    expect(recordPosition({}, 'culture_item', 'x', COMPLETION_THRESHOLD)['culture_item:x'].completedAt).not.toBeNull();
  });

  it('no highlight is created by a jump', () => {
    const screen = read('src/features/culture/CultureItemDetailScreen.tsx');
    const jump = screen.slice(screen.indexOf('const jumpToSection'), screen.indexOf('const resumeOffset'));
    expect(jump).not.toMatch(/actions\.save|PassageActions|markRead|\.record\(/);
  });

  it('Read & Listen: follow mode keeps auto-scroll; a manual TOC jump pauses it via the existing policy', () => {
    const screen = read('src/features/culture/CultureItemDetailScreen.tsx');
    const jump = screen.slice(screen.indexOf('const jumpToSection'), screen.indexOf('const resumeOffset'));
    expect(jump).toContain('lastManualScroll.current = Date.now();');
    expect(screen).toContain('shouldAutoScroll(follow, lastManualScroll.current, Date.now())');
  });

  it('Reader Mode: the Contents button sits beside the Aa control (shown in focus mode too); offline: derived from the loaded article', () => {
    const screen = read('src/features/culture/CultureItemDetailScreen.tsx');
    expect(screen).toMatch(/<ReaderButton [^/]*\/>\s*\{toc \? <ContentsButton sections=\{toc\}/);
    const model = read('src/features/culture/reader/navigator/sectionNavigator.ts');
    expect(model).not.toMatch(/fetch|supabase|AsyncStorage/);
  });

  it('labels come from the same KG/RU/EN section labels the article renders', () => {
    const screen = read('src/features/culture/CultureItemDetailScreen.tsx');
    expect(screen).toContain('label: t(field.labelKey)');
    for (const locale of [kg, ru, en]) expect((locale as unknown as { culture: { item: Record<string, string> } }).culture.item.historyLabel).toBeTruthy();
  });
});
