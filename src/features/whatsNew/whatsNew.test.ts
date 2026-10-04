import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';

import { unseenItems, whatsNewItems, WINDOW_DAYS, type WhatsNewSource } from './whatsNew';

const NOW = new Date('2026-10-03T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86400000).toISOString();
const src = (id: string, fields: Partial<WhatsNewSource> = {}): WhatsNewSource => ({ type: 'culture_item', id, title: id, ...fields });
const migration = fs.readFileSync(path.join(__dirname, '../../../supabase/migrations/20261003000001_content_publication_timestamps.sql'), 'utf8');

describe("What's New", () => {
  it('orders by the real timestamp, newest first', () => {
    const items = whatsNewItems([src('a', { published_at: daysAgo(10) }), src('b', { published_at: daysAgo(2) }), src('c', { content_updated_at: daysAgo(5) })], NOW);
    expect(items.map((item) => item.id)).toEqual(['b', 'c', 'a']);
  });

  it('new vs updated: a same-day fix of a new story stays "New"; a later text change is "Updated"', () => {
    expect(whatsNewItems([src('a', { published_at: daysAgo(3), content_updated_at: daysAgo(3) })], NOW)[0].kind).toBe('new');
    expect(whatsNewItems([src('b', { published_at: daysAgo(90), content_updated_at: daysAgo(4) })], NOW)[0]).toMatchObject({ kind: 'updated', at: daysAgo(4) });
    expect(whatsNewItems([src('c', { published_at: daysAgo(WINDOW_DAYS + 1) })], NOW)).toEqual([]);
  });

  it('content with no trustworthy timestamp is excluded (all pre-existing rows)', () => {
    expect(whatsNewItems([src('old'), src('bad', { published_at: 'not-a-date' }), src('future', { published_at: '2027-01-01T00:00:00Z' })], NOW)).toEqual([]);
    // Existing rows are never backfilled with a fake date.
    expect(migration).not.toMatch(/update public\.culture_(items|materials) set published_at/i);
    expect(migration).toMatch(/alter column published_at set default now\(\)/);
  });

  it('"updated" only for authored text changes (trigger watches content columns only)', () => {
    expect(migration).toMatch(/new\.title, new\.origin, new\.history/);
    expect(migration).not.toMatch(/new\.sort_order|new\.image_url|new\.accuracy_level/);
  });

  it('seen state: only items newer than the last visit are unseen; a later update becomes unseen again', () => {
    const items = whatsNewItems([src('a', { published_at: daysAgo(5) }), src('b', { content_updated_at: daysAgo(1), published_at: null })], NOW);
    expect(unseenItems(items, null)).toHaveLength(2);
    expect(unseenItems(items, daysAgo(3)).map((item) => item.id)).toEqual(['b']);
    expect(unseenItems(items, NOW.toISOString())).toEqual([]);
  });

  it('removed / unpublished content simply disappears (derived from the loaded list)', () => {
    expect(whatsNewItems([], NOW)).toEqual([]);
    const hook = fs.readFileSync(path.join(__dirname, 'useWhatsNew.ts'), 'utf8');
    expect(hook).toMatch(/useAllCultureItems\(\)/);
    expect(hook).not.toMatch(/AsyncStorage\.setItem\([^)]*items/);
  });

  it('offline: uses already-loaded/downloaded content lists (no extra request)', () => {
    const hook = fs.readFileSync(path.join(__dirname, 'useWhatsNew.ts'), 'utf8');
    expect(hook).not.toMatch(/supabase|fetch\(/);
  });

  it('"Updated" is independent of verification - nothing here reads or claims it', () => {
    const files = ['whatsNew.ts', 'WhatsNewScreen.tsx'].map((file) => fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')).join('\n');
    expect(files).not.toMatch(/accuracy_level|verified|verification/);
    expect(whatsNewItems([src('a', { published_at: daysAgo(90), content_updated_at: daysAgo(2), update_note: 'Added a section about the frame.' })], NOW)[0].note).toBe('Added a section about the frame.');
    expect(whatsNewItems([src('b', { published_at: daysAgo(90), content_updated_at: daysAgo(2) })], NOW)[0].note).toBeNull();
  });

  it('Home shows a compact entry only when there are unseen updates', () => {
    const screen = fs.readFileSync(path.join(__dirname, 'WhatsNewScreen.tsx'), 'utf8');
    expect(screen).toMatch(/if \(unseen\.length === 0\) return null;/);
    expect(screen).toMatch(/unseen\.slice\(0, 3\)/);
  });

  it('KG / RU / EN', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { whatsNew: Record<string, string> }).whatsNew;
      for (const key of ['title', 'new', 'recentlyUpdated', 'updated', 'newStory', 'count_other', 'upToDate']) expect(block[key]).toBeTruthy();
    }
  });
});
