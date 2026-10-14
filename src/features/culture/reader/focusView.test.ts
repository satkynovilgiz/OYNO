import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';

import { COMPLETION_THRESHOLD, recordPosition } from '../reading/readingModel';
import { FOCUS_HIDES, FOCUS_KEEPS, restoreOnSwitch } from './focusViewRules';

const read = (file: string) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const detail = read('../CultureItemDetailScreen.tsx');
const material = read('../MaterialDetailScreen.tsx');

describe('Focus view - position', () => {
  it('switching keeps the current section (by key); without one, the reading ratio', () => {
    expect(restoreOnSwitch(false, true, 'history', ['origin', 'history'])).toEqual({ kind: 'section', key: 'history' });
    expect(restoreOnSwitch(true, false, 'history', ['origin', 'history'])).toEqual({ kind: 'section', key: 'history' });
    expect(restoreOnSwitch(false, true, null, ['origin'])).toEqual({ kind: 'ratio' });
    // A key the article no longer has is never used.
    expect(restoreOnSwitch(false, true, 'gone', ['origin'])).toEqual({ kind: 'ratio' });
    // Text size / spacing changes are not view switches.
    expect(restoreOnSwitch(true, true, 'origin', ['origin'])).toEqual({ kind: 'none' });
  });

  it('the restore is a jump (no progress / completion recorded) and a hand scroll cancels it', () => {
    expect(detail).toMatch(/if \(top !== null\) reading\.jumpTo\(jumpOffset\(top\), false\);/);
    expect(detail).toMatch(/onScrollBeginDrag=\{\(\) => \{\s*lastManualScroll\.current = Date\.now\(\);\s*pendingSection\.current = null;/);
  });
});

describe('Focus view - never completes reading by scrolling', () => {
  it('in Focus view a scroll to the end records progress, not completion', () => {
    const data = recordPosition({}, 'culture_item', 'a', 1, new Date('2026-10-14T10:00:00Z'), { completeByScroll: false });
    expect(data['culture_item:a']).toMatchObject({ furthest: 1, completedAt: null });
    // The standard view keeps its existing rule; an already completed article stays completed.
    expect(recordPosition({}, 'culture_item', 'a', COMPLETION_THRESHOLD)['culture_item:a'].completedAt).not.toBeNull();
    const done = recordPosition({}, 'culture_item', 'a', 1);
    expect(recordPosition(done, 'culture_item', 'a', 0.5, new Date(), { completeByScroll: false })['culture_item:a'].completedAt).toBe(done['culture_item:a'].completedAt);
  });
  it('both reading screens pass the Focus view state to the tracker', () => {
    for (const screen of [detail, material]) expect(screen).toMatch(/useReadingTracker\('culture_(item|material)', \w+\.id, \{ completeByScroll: !focus \}\)/);
  });
});

describe('Focus view - what stays and what steps back', () => {
  it('keeps and hides are disjoint', () => {
    expect(FOCUS_KEEPS.filter((key) => (FOCUS_HIDES as readonly string[]).includes(key))).toEqual([]);
  });
  it('essentials are never behind a focus condition', () => {
    for (const element of ['<SourcesAndNotes', '<ReportIssueLink', '<SectionBookmark', '<SourceLensToggle', '<KeyTermsSection', '<AudioGuidePlayer', '<ReadingActions', '<ReaderButton', '<GlossaryText']) {
      const line = detail.split('\n').find((row) => row.includes(element));
      expect([element, !!line && !/focus \? null|!focus/.test(line)]).toEqual([element, true]);
    }
  });
  it('secondary interface is hidden in Focus view', () => {
    expect(detail).toMatch(/\{focus \? null : \(\s*<>\s*<IconButton\s*icon=\{Share2\}/);
    expect(detail).toMatch(/\{focus \? null : <SaveQuestion/);
    expect(detail).toMatch(/\{focus \? null : \(\s*<PassageActions/);
    expect(material).toMatch(/\{focus \? null : \(\s*<PassageActions/);
  });
  it('a clear entry and exit on both screens; Escape exits on web', () => {
    for (const screen of [detail, material]) {
      expect(screen).toMatch(/<FocusViewButton on=\{focus\}/);
      expect(screen).toMatch(/<FocusExitBar on=\{focus\} \/>/);
    }
    expect(read('FocusView.tsx')).toMatch(/event\.key === 'Escape'/);
    expect(read('FocusView.tsx')).toMatch(/announceForAccessibility/);
  });
  it('KG / RU / EN', () => {
    for (const dict of [kg, ru, en]) {
      const block = (dict as unknown as { focusView: Record<string, string> }).focusView;
      for (const key of ['enter', 'enterHint', 'exit', 'active', 'activeHint', 'announceOn', 'announceOff']) expect([key, !!block[key]?.trim()]).toEqual([key, true]);
    }
  });
});
