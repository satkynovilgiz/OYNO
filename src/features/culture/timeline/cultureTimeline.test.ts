import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';

import { CULTURE_TIMELINE, EXCLUDED_CANDIDATES, excerptFor, filterTimeline, sortTimeline, validateTimeline, validEvents, type CultureTimelineEvent } from './cultureTimeline';

const root = path.join(__dirname, '../../../..');

/** The authored sentences as they exist in culture_items (read-only audit 2026-10-03). */
const SRC = ['https://example.org/a'];
const ITEMS = [
  { id: 'horse-jorgo-salysh', sources: SRC, history: 'Жорго - жылкынын жүрүшү. 1971-жылдан тартып Кыргыз Республикасында жорго салыш расмий улуттук спорт түрү катары бекитилген.' },
  { id: 'horse-tyiyn-enmei', sources: SRC, history: 'Байыркы оюндардын бири; 1993-жылкы бирдиктүү классификацияда улуттук спорт түрү катары бекитилген.' },
  { id: 'horse-kok-boru', sources: SRC, history: 'Азыркы бирдиктүү эрежелери 1996-жылы кинорежиссёр Болот Шамшиев тарабынан иштелип чыккан. 2001-жылы 9-ноябрда Бишкекте Көк бөрү эл аралык федерациясы түзүлгөн. 2017-жылы декабрда ЮНЕСКОнун Материалдык эмес маданий мурас тизмесине кирген.' },
  { id: 'shyrdak-craft', sources: SRC, history: '2012-жылы кыргыздын салттуу шырдак жана ала кийиз тигүү өнөрү ЮНЕСКОнун Материалдык эмес маданий мурас тизмесине кирген.' },
  { id: 'shyrdak-ala-kiyiz', sources: SRC, modern_status: '2012-жылы ЮНЕСКОнун тизмесине шырдак менен катар ала кийиз да кирген.' },
  { id: 'clothing-ak-kalpak', sources: SRC, modern_status: 'Кыргызстандын мамлекеттик символу катары да таанылат; 2019-жылдан тартып 5-март "Дүйнөлүк калпак күнү" катары белгиленет.' },
];
const e = (over: Partial<CultureTimelineEvent>): CultureTimelineEvent => ({ id: 'x', datePrecision: 'year', year: 1971, displayDateKey: 'k', contentItemId: 'horse-jorgo-salysh', sourceField: 'history', sourceIds: ['horse-jorgo-salysh'], titleKey: 't', ...over });

describe('Culture Timeline content', () => {
  it('every curated event is backed by its authored, sourced field', () => {
    expect(validateTimeline(CULTURE_TIMELINE, ITEMS)).toEqual([]);
    expect(validEvents(CULTURE_TIMELINE, ITEMS)).toHaveLength(CULTURE_TIMELINE.length);
  });

  it('only exact_date / year / year_range; no centuries or approximate dates', () => {
    for (const event of CULTURE_TIMELINE) expect(['exact_date', 'year', 'year_range']).toContain(event.datePrecision);
    expect(validateTimeline([e({ datePrecision: 'century' as never })], ITEMS)).toContainEqual(expect.stringContaining('unsupported precision'));
  });

  it('rejects a year the text does not state, missing sources, bad dates and duplicates', () => {
    expect(validateTimeline([e({ year: 1972 })], ITEMS)).toContainEqual(expect.stringContaining('year not stated'));
    expect(validateTimeline([e({})], [{ ...ITEMS[0], sources: [] }])).toContainEqual(expect.stringContaining('has no sources'));
    expect(validateTimeline([e({ sourceIds: [] })], ITEMS)).toContainEqual(expect.stringContaining('no source ids'));
    expect(validateTimeline([e({ datePrecision: 'exact_date', exactDate: '1972-01-01' })], ITEMS)).toContainEqual(expect.stringContaining('bad exact date'));
    expect(validateTimeline([e({ datePrecision: 'year_range', startYear: 1971, endYear: 1980 })], ITEMS)).toContainEqual(expect.stringContaining('end year not stated'));
    expect(validateTimeline([e({}), e({})], ITEMS)).toContainEqual('x: duplicate');
    expect(validateTimeline([e({ contentItemId: 'nope' })], ITEMS)).toContainEqual('x: item missing');
    // Content missing from the loaded data -> the event is simply not shown.
    expect(validEvents(CULTURE_TIMELINE, ITEMS.slice(1)).map((event) => event.id)).not.toContain('jorgo-salysh-official-sport');
  });

  it('excluded candidates never reach the timeline', () => {
    const used = new Set(CULTURE_TIMELINE.map((event) => `${event.contentItemId}:${event.sourceField}`));
    for (const candidate of EXCLUDED_CANDIDATES.filter((c) => c.itemId !== 'horse-kok-boru' || c.field !== 'history')) {
      if (candidate.itemId === 'shyrdak-ala-kiyiz') continue; // merged as a second source only
      expect(used.has(`${candidate.itemId}:${candidate.field}`)).toBe(false);
    }
    for (const event of CULTURE_TIMELINE) expect(event.year).toBeGreaterThan(1900);
  });

  it('the excerpt is the verbatim authored sentence', () => {
    expect(excerptFor(ITEMS[2].history, 2001)).toBe('2001-жылы 9-ноябрда Бишкекте Көк бөрү эл аралык федерациясы түзүлгөн.');
    expect(excerptFor(ITEMS[2].history, 1850)).toBeNull();
    expect(excerptFor(null, 2001)).toBeNull();
  });

  it('sorts oldest/newest deterministically', () => {
    const oldest = sortTimeline(CULTURE_TIMELINE, 'oldest').map((event) => event.year);
    expect(oldest).toEqual([...oldest].sort((a, b) => a - b));
    expect(sortTimeline(CULTURE_TIMELINE, 'newest')[0].id).toBe('world-kalpak-day-since');
  });

  it('local search folds Kyrgyz letters and matches years', () => {
    const rows = CULTURE_TIMELINE.map((event) => ({ event, title: kg.cultureTimeline.events[event.id as keyof typeof kg.cultureTimeline.events], excerpt: null }));
    expect(filterTimeline(rows, 'көк бөрү').length).toBeGreaterThanOrEqual(3);
    expect(filterTimeline(rows, 'kok').length).toBe(0);
    expect(filterTimeline(rows, 'кок бору').length).toBeGreaterThanOrEqual(3);
    expect(filterTimeline(rows, '2012').map((row) => row.event.id)).toEqual(['shyrdak-ala-kiyiz-unesco']);
    expect(filterTimeline(rows, '  ')).toHaveLength(rows.length);
  });
});

describe('Culture Timeline wiring', () => {
  const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
  it('route, Culture entry, analytics and reuse of existing screens', () => {
    expect(fs.existsSync(path.join(root, 'src/app/culture/timeline/index.tsx'))).toBe(true);
    expect(read('src/features/culture/CultureScreen.tsx')).toContain('<TimelineEntryRow />');
    const analytics = read('src/services/analytics/analytics.ts');
    expect(analytics).toContain("'culture_timeline_opened'");
    expect(analytics).toContain("'culture_timeline_event_opened'");
    const screen = read('src/features/culture/timeline/CultureTimelineScreen.tsx');
    expect(screen).toContain("track('culture_timeline_event_opened', { event_id: event.id, content_id: item.id })");
    expect(screen).toContain('sourceExplorerRoute(');
    expect(screen).toContain('thenNowRoute(');
    expect(screen).toContain('`/culture/item/${item.id}`');
  });

  it('every event title and UI string exists in KG/RU/EN', () => {
    for (const locale of [en, ru, kg]) {
      const section = locale.cultureTimeline as Record<string, unknown> & { events: Record<string, string> };
      for (const event of CULTURE_TIMELINE) expect(section.events[event.id]).toBeTruthy();
      for (const key of ['title', 'entryMeta', 'intro', 'introChild', 'searchPlaceholder', 'empty', 'noMatches', 'viewSources', 'thenNow', 'openStory']) expect(section[key]).toBeTruthy();
    }
  });
});
