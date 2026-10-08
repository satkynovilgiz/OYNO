import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';

import { ACTIVITY_CATALOG, chooseActivities, explanationKey, INTERESTS, PAGE_SIZE, pathStepActivity, rankActivities, TIME_BUDGETS, type ChooserSignals } from './activityChooser';

const BASE: ChooserSignals = { isOffline: false, isAvailableOffline: () => true, dailyDoneToday: false, tried: new Set(), completed: new Set(), pathStep: null };
const signals = (patch: Partial<ChooserSignals> = {}): ChooserSignals => ({ ...BASE, ...patch });
const ids = (minutes: 2 | 5 | 10, interest: 'discover' | 'play' | 'create' | 'listen', patch: Partial<ChooserSignals> = {}) => rankActivities(minutes, interest, signals(patch)).map((entry) => entry.activity.id);

const appDir = path.join(__dirname, '../../../app');
/** Does an Expo Router file exist for this route (static or index)? */
function routeExists(route: string): boolean {
  const clean = route.split('?')[0].replace(/^\//, '');
  const segments = clean.split('/');
  const walk = (dir: string, rest: string[]): boolean => {
    if (rest.length === 0) return fs.existsSync(path.join(dir, 'index.tsx'));
    const [head, ...tail] = rest;
    if (tail.length === 0 && fs.existsSync(path.join(dir, `${head}.tsx`))) return true;
    if (fs.existsSync(path.join(dir, head)) && walk(path.join(dir, head), tail)) return true;
    // Dynamic segment: [param].tsx or [param]/
    const dynamic = fs.readdirSync(dir).filter((name) => name.startsWith('['));
    return dynamic.some((name) => (tail.length === 0 && name.endsWith('.tsx')) || (!name.endsWith('.tsx') && walk(path.join(dir, name), tail)));
  };
  return walk(appDir, segments);
}

describe('only real, available activities', () => {
  it('every catalogue activity opens an existing screen; ids are unique; every interest has something', () => {
    expect(new Set(ACTIVITY_CATALOG.map((activity) => activity.id)).size).toBe(ACTIVITY_CATALOG.length);
    for (const activity of ACTIVITY_CATALOG) expect([activity.id, routeExists(activity.route)]).toEqual([activity.id, true]);
    expect(routeExists(pathStepActivity({ pathTitle: 'p', itemTitle: 'i', route: '/culture/item/boz-uy-tunduk' }).route)).toBe(true);
    for (const interest of INTERESTS) expect(ACTIVITY_CATALOG.some((activity) => activity.interest === interest)).toBe(true);
  });

  it('every title, description, estimate basis and explanation exists in KG, RU and EN', () => {
    for (const lang of [en, ru, kg]) {
      const section = (lang as unknown as { activityChooser: Record<string, unknown> }).activityChooser as { basis: Record<string, string>; items: Record<string, { title?: string; description: string }>; explain: Record<string, Record<string, string>> };
      for (const activity of ACTIVITY_CATALOG) {
        expect(section.basis[activity.basis]).toBeTruthy();
        expect(section.items[activity.id].title).toBeTruthy();
        expect(section.items[activity.id].description).toBeTruthy();
        const [, , interest, length] = explanationKey(activity).split('.');
        expect(section.explain[interest][length]).toBeTruthy();
      }
      expect(section.items.pathStep.description).toBeTruthy();
    }
  });
});

describe('filtering', () => {
  it('by interest and time: never longer than the time chosen, never another interest, at most three', () => {
    for (const minutes of TIME_BUDGETS) {
      for (const interest of INTERESTS) {
        const result = chooseActivities(minutes, interest, signals());
        if (result.kind !== 'suggestions') continue;
        expect(result.suggestions.length).toBeLessThanOrEqual(PAGE_SIZE);
        for (const { activity } of result.suggestions) {
          expect(activity.interest).toBe(interest);
          expect(activity.minutes).toBeLessThanOrEqual(minutes);
        }
      }
    }
    expect(ids(2, 'play')).toEqual(['jaaAtuu', 'kyzKuumai']);
    expect(ids(10, 'create')).toEqual(['oymo', 'bozUy', 'shyrdak', 'restore']); // more of the time first
  });

  it('offline: only activities whose screen can open with what is on the device', () => {
    const available = (route: string) => route !== '/explore/map-challenge' && route !== '/daily';
    expect(ids(5, 'discover', { isOffline: true, isAvailableOffline: available })).toEqual(['detective']);
    const result = chooseActivities(5, 'discover', signals({ isOffline: true, isAvailableOffline: available }));
    expect(result.kind === 'suggestions' && result.suggestions.every((entry) => entry.worksOffline)).toBe(true);
    // Online, the availability check is not a filter.
    expect(ids(5, 'discover', { isAvailableOffline: available })).toContain('mapChallenge');
  });
});

describe('completion signals, handled on purpose', () => {
  it("today's Daily OYNO, once done, is not suggested again today", () => {
    expect(ids(5, 'discover')).toContain('daily');
    expect(ids(5, 'discover', { dailyDoneToday: true })).not.toContain('daily');
  });

  it('a completed one-time lesson is not suggested; practice and creative activities stay, after untried ones', () => {
    expect(ids(5, 'listen')).toContain('komuzLesson');
    expect(ids(5, 'listen', { completed: new Set(['komuzLesson']) })).not.toContain('komuzLesson');
    expect(ids(10, 'create', { tried: new Set(['oymo', 'bozUy']) })).toEqual(['shyrdak', 'restore', 'oymo', 'bozUy']);
    const again = rankActivities(10, 'create', signals({ tried: new Set(['oymo']) })).find((entry) => entry.activity.id === 'oymo');
    expect(again?.reason).toBe('again');
  });

  it("a started Learning Path's next reading comes first (and only for Discover)", () => {
    const pathStep = { pathTitle: 'Life in the boz üy', itemTitle: 'Түндүк', route: '/culture/item/boz-uy-tunduk' };
    const ranked = rankActivities(5, 'discover', signals({ pathStep }));
    expect(ranked[0]).toMatchObject({ reason: 'continuePath', activity: { route: '/culture/item/boz-uy-tunduk', title: 'Түндүк' } });
    expect(rankActivities(5, 'play', signals({ pathStep })).some((entry) => entry.reason === 'continuePath')).toBe(false);
    // Offline and not cached: not offered.
    expect(rankActivities(5, 'discover', signals({ pathStep, isOffline: true, isAvailableOffline: (route) => !route.startsWith('/culture/item') })).some((entry) => entry.reason === 'continuePath')).toBe(false);
  });
});

describe('another suggestion and honest fallbacks', () => {
  it('"Show others" pages through the rest, then wraps', () => {
    const first = chooseActivities(10, 'create', signals(), 0);
    const second = chooseActivities(10, 'create', signals(), 1);
    const third = chooseActivities(10, 'create', signals(), 2);
    expect(first.kind === 'suggestions' && first.suggestions.map((entry) => entry.activity.id)).toEqual(['oymo', 'bozUy', 'shyrdak']);
    expect(second.kind === 'suggestions' && second.suggestions.map((entry) => entry.activity.id)).toEqual(['restore']);
    expect(third).toEqual(first);
    expect(first.kind === 'suggestions' && first.pages).toBe(2);
  });

  it('nothing fits: more time would help (with the shortest real option), or it is the connection, or all done', () => {
    expect(chooseActivities(2, 'listen', signals())).toEqual({ kind: 'empty', why: 'needsMoreTime', shortest: expect.objectContaining({ id: 'komuzListen', minutes: 3 }) });
    expect(chooseActivities(5, 'discover', signals({ isOffline: true, isAvailableOffline: () => false }))).toEqual({ kind: 'empty', why: 'offline', shortest: null });
    const onlyLesson = ACTIVITY_CATALOG.filter((activity) => activity.id === 'komuzLesson');
    expect(chooseActivities(10, 'listen', signals({ completed: new Set(['komuzLesson']) }), 0, onlyLesson)).toEqual({ kind: 'empty', why: 'allDone', shortest: null });
  });

  it('the explanation is plain and matches the activity', () => {
    expect(explanationKey(ACTIVITY_CATALOG.find((activity) => activity.id === 'shyrdak')!)).toBe('activityChooser.explain.create.short');
    expect(en.activityChooser.explain.create.short).toBe('A short creative activity.');
  });
});

describe('privacy', () => {
  it('the choice is never stored or sent: the chooser touches no storage, network or analytics', () => {
    const dir = __dirname;
    for (const file of fs.readdirSync(dir).filter((name) => !name.endsWith('.test.ts'))) {
      const text = fs.readFileSync(path.join(dir, file), 'utf8');
      expect([file, /AsyncStorage|supabase|fetch\(|track\(|setItem/.test(text)]).toEqual([file, false]);
    }
  });
});
