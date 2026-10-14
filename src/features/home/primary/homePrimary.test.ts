import * as fs from 'fs';
import * as path from 'path';

import type { ReadingProgress } from '@/features/culture/reading/readingModel';
import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { routeExists } from '@/test-utils/routeExists';

import type { HomeRecommendation } from '../homeRecommendation';
import { CREATE_GROUPS } from './createHub';
import { HOME_DESTINATIONS } from './homeDestinations';
import { CREATE_ROUTE, DISCOVER_ROUTE, GUIDE_ROUTE, heroShowsRecommendation, homeAudience, pickContinue, RECOVERY_ROUTE, type ContinueInputs } from './homePrimaryModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const reading: ReadingProgress = { contentType: 'culture_item', contentId: 'boz-uy-tunduk', progress: 0.4, furthest: 0.5, lastReadAt: '2026-10-01T10:00:00Z', completedAt: null, lastSectionKey: 'history' };
const rec = (patch: Partial<HomeRecommendation>): HomeRecommendation => ({ mode: 'continue', kind: 'trail', contentId: 't1', route: '/culture/item/boz-uy-karkas', progress: { completed: 1, total: 4 }, targetId: null, ...patch });
const BASE: ContinueInputs = { unsaved: [], guideActive: false, reading: null, recommendation: null, isAvailable: () => true };
const input = (patch: Partial<ContinueInputs>): ContinueInputs => ({ ...BASE, ...patch });
const ROOT = path.join(__dirname, '../../../..');

describe('Continue - one card of real unfinished work', () => {
  it('nothing unfinished -> null (never an invented card)', () => {
    expect(pickContinue(BASE)).toBeNull();
    // Suggestions are not continuations.
    expect(pickContinue(input({ recommendation: rec({ mode: 'today', kind: 'daily', route: '/daily' }) }))).toBeNull();
    expect(pickContinue(input({ recommendation: rec({ mode: 'exploreNext' }) }))).toBeNull();
    expect(pickContinue(input({ recommendation: rec({ kind: 'game', route: '/games/jaa-atuu', progress: null }) }))).toBeNull();
  });

  it('priority: unsaved work > guide > reading > journey', () => {
    const all = input({
      unsaved: [{ kind: 'portfolio', route: '/profile/oymo-portfolios/p1', survivesRestart: false }],
      guideActive: true,
      reading: { record: reading, route: '/culture/item/boz-uy-tunduk' },
      recommendation: rec({}),
    });
    expect(pickContinue(all)?.kind).toBe('unsaved');
    expect(pickContinue({ ...all, unsaved: [] })).toEqual({ kind: 'guide', route: GUIDE_ROUTE });
    expect(pickContinue({ ...all, unsaved: [], guideActive: false })).toMatchObject({ kind: 'reading', route: '/culture/item/boz-uy-tunduk?section=history' });
    expect(pickContinue({ ...all, unsaved: [], guideActive: false, reading: null })).toMatchObject({ kind: 'journey', route: '/culture/item/boz-uy-karkas' });
  });

  it('one unsaved entry opens its editor; several open the Recovery Center; the guide pending step is not "unsaved"', () => {
    const one = pickContinue(input({ unsaved: [{ kind: 'journal', route: '/journal/new', survivesRestart: true }] }));
    expect(one).toEqual({ kind: 'unsaved', count: 1, entryKind: 'journal', route: '/journal/new', survivesRestart: true });
    const two = pickContinue(
      input({
        unsaved: [
          { kind: 'journal', route: '/journal/new', survivesRestart: true },
          { kind: 'scrapbook', route: '/profile/scrapbooks/s1', survivesRestart: false },
        ],
      }),
    );
    expect(two).toEqual({ kind: 'unsaved', count: 2, entryKind: null, route: RECOVERY_ROUTE, survivesRestart: false });
    expect(pickContinue(input({ unsaved: [{ kind: 'firstUse', route: '/start', survivesRestart: false }] }))).toBeNull();
  });

  it('offline: unavailable screens are skipped; unsaved work falls back to the local Recovery Center', () => {
    const offline = (route: string) => !route.startsWith('/culture/item');
    expect(pickContinue(input({ unsaved: [{ kind: 'questionNew', route: '/culture/item/a?section=b', survivesRestart: false }], isAvailable: offline }))).toMatchObject({ route: RECOVERY_ROUTE });
    expect(pickContinue(input({ reading: { record: reading, route: '/culture/item/x' }, isAvailable: offline }))).toBeNull();
    expect(pickContinue(input({ reading: { record: reading, route: '/culture/item/x' }, recommendation: rec({ route: '/collections/c1' }), isAvailable: offline }))).toMatchObject({ kind: 'journey', route: '/collections/c1' });
  });

  it('reading without a recorded section opens the article itself', () => {
    expect(pickContinue(input({ reading: { record: { ...reading, lastSectionKey: null }, route: '/culture/item/x' } }))?.route).toBe('/culture/item/x');
  });
});

describe('first-use vs returning; hero never duplicates Continue', () => {
  const none = { pick: null, hasReading: false, hasRecent: false, hasPlayed: false, guideStarted: false };
  it('new only with no trace of use at all', () => {
    expect(homeAudience(none)).toBe('new');
    for (const key of ['hasReading', 'hasRecent', 'hasPlayed', 'guideStarted'] as const) expect(homeAudience({ ...none, [key]: true })).toBe('returning');
    expect(homeAudience({ ...none, pick: { kind: 'guide', route: GUIDE_ROUTE } })).toBe('returning');
  });
  it('a continuation is shown in the Continue card only', () => {
    expect(heroShowsRecommendation(rec({}))).toBe(false);
    expect(heroShowsRecommendation(rec({ mode: 'today', kind: 'daily' }))).toBe(true);
    expect(heroShowsRecommendation(rec({ kind: 'game' }))).toBe(true);
    expect(heroShowsRecommendation(rec({ mode: 'complete', kind: 'explore' }))).toBe(true);
  });
});

describe('destinations and copy', () => {
  it('Discover, Create, every Create hub entry and the Recovery/guide routes open existing screens', () => {
    for (const route of [DISCOVER_ROUTE, CREATE_ROUTE, RECOVERY_ROUTE, GUIDE_ROUTE, ...CREATE_GROUPS.flatMap((group) => group.entries.map((entry) => entry.route))]) expect([route, routeExists(route)]).toEqual([route, true]);
    for (const destination of HOME_DESTINATIONS) expect([destination.route, routeExists(destination.route)]).toEqual([destination.route, true]);
  });

  it('every label exists in KG, RU and EN', () => {
    const get = (locale: unknown, key: string) => key.split('.').reduce<unknown>((obj, part) => (obj as Record<string, unknown>)?.[part], locale);
    const keys = [
      ...CREATE_GROUPS.flatMap((group) => [`createHub.groups.${group.id}`, ...group.entries.flatMap((entry) => [entry.titleKey, entry.bodyKey])]),
      'homePrimary.title',
      'homePrimary.newTitle',
      'homePrimary.newBody',
      'homePrimary.discover.title',
      'homePrimary.create.title',
      'homePrimary.continue.emptyNew',
      'homePrimary.continue.emptyReturning',
      'homePrimary.continue.checking',
      ...['portfolio', 'scrapbook', 'questionNew', 'questionEdit', 'compareNote', 'explanation', 'journal'].map((kind) => `recovery.kinds.${kind}`),
    ];
    for (const locale of [en, ru, kg]) for (const key of keys) expect([key, typeof get(locale, key)]).toEqual([key, 'string']);
  });

  it('Home renders the primary block before the sections; the first-use card only offers', () => {
    const home = fs.readFileSync(path.join(ROOT, 'src/features/home/HomeScreen.tsx'), 'utf8');
    expect(home.indexOf('<HomePrimary')).toBeGreaterThan(0);
    expect(home.indexOf('<HomePrimary')).toBeLessThan(home.indexOf('visibleSections('));
    expect(home).toContain('<FirstUseHomeCard offerOnly />');
    expect(home).toContain('heroShowsRecommendation(recommendation)');
  });
});
