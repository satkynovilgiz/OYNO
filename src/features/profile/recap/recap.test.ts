import * as fs from 'fs';
import * as path from 'path';

import i18next from 'i18next';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';

import { buildOYNORecap, mostPlayedGame, presentMetrics, RECAP_PRESENTATION, type RecapInput } from './recapModel';
import { buildRecapShareCard } from './recapShare';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const EMPTY: RecapInput = {
  signedIn: false,
  gamesPlayed: 0,
  gameStats: {},
  gameOrder: ['chuko', 'ordo', 'jaa_atuu', 'kok_boru'],
  challengeResults: {},
  achievementsUnlocked: 0,
  journalEntries: 0,
  savedItems: 0,
  dailyDays: 0,
  placesVisited: 0,
  personalBests: 0,
};
const ACTIVE: RecapInput = {
  ...EMPTY,
  gamesPlayed: 14,
  gameStats: { ordo: { played: 6 }, jaa_atuu: { played: 8 } },
  challengeResults: { 'daily:2026-09-30': { completedAt: '2026-09-30T10:00:00Z' }, journey: { completedAt: null } },
  achievementsUnlocked: 5,
  journalEntries: 3,
  savedItems: 4,
  dailyDays: 2,
  placesVisited: 3,
  personalBests: 2,
};
const source = (file: string) => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('My OYNO Recap', () => {
  it('new user: empty state, no wall of zeros', () => {
    expect(buildOYNORecap(EMPTY)).toEqual({ metrics: [], highlights: [], isEmpty: true });
  });

  it('guest recap: every number is this device', () => {
    const recap = buildOYNORecap(ACTIVE);
    expect(recap.isEmpty).toBe(false);
    expect(recap.metrics.every((metric) => metric.source === 'device')).toBe(true);
    expect(recap.metrics.find((metric) => metric.id === 'challenges')!.value).toBe(1);
  });

  it('signed-in recap: account numbers, personal bests still marked as this device', () => {
    const recap = buildOYNORecap({ ...ACTIVE, signedIn: true });
    expect(recap.metrics.find((metric) => metric.id === 'games')!.source).toBe('account');
    expect(recap.metrics.find((metric) => metric.id === 'personalBests')!.source).toBe('device');
  });

  it('unavailable or zero metrics are omitted; no invented culture/listening/rank metrics exist', () => {
    const recap = buildOYNORecap({ ...EMPTY, gamesPlayed: 2, gameStats: { chuko: { played: 2 } } });
    expect(recap.metrics.map((metric) => metric.id)).toEqual(['games']);
    const model = source('recapModel.ts');
    expect(model).not.toMatch(/'(culture|learned|listening|rank|percentile|average|favourite|favorite)'/i);
  });

  it('most played: highest count, a tie goes to the game listed first; "most played", never "favourite"', () => {
    expect(mostPlayedGame({ ordo: { played: 4 }, chuko: { played: 4 } }, EMPTY.gameOrder)).toEqual({ gameId: 'chuko', plays: 4 });
    expect(mostPlayedGame({ jaa_atuu: { played: 8 }, ordo: { played: 6 } }, EMPTY.gameOrder)).toEqual({ gameId: 'jaa_atuu', plays: 8 });
    expect(mostPlayedGame({}, EMPTY.gameOrder)).toBeNull();
    for (const dict of [en, ru, kg]) expect(JSON.stringify((dict as { recap: unknown }).recap)).not.toMatch(/favou?rite|любим|сүйүктүү/i);
  });

  it('at most 3 highlights, all from real signals (no latest achievement: unlock dates are not loaded)', () => {
    const recap = buildOYNORecap(ACTIVE);
    expect(recap.highlights.map((highlight) => highlight.kind)).toEqual(['mostPlayed', 'dailyDays']);
    expect(recap.highlights.length).toBeLessThanOrEqual(3);
  });

  it('share card: only public-style counts - never journal, saved items or account data', async () => {
    const instance = i18next.createInstance();
    await instance.init({ lng: 'en', resources: { en: { translation: en } }, interpolation: { escapeValue: false } });
    const card = buildRecapShareCard(buildOYNORecap(ACTIVE), (key, options) => instance.t(key, options) as string);
    expect(card).toMatchObject({ title: 'My OYNO story', label: 'All time', subtitle: '14 games played · 1 challenge · 5 achievements · 3 places' });
    expect(JSON.stringify(card)).not.toMatch(/memor|saved|journal|@|user|email|download|admin|feedback/i);
    // The builder never even receives journal text or names.
    const code = source('recapShare.ts').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/entries|favoriteIds|title_kg|email/);
  });

  it('account switching: nothing renders until progress is loaded FOR the current owner', () => {
    const hook = source('useOYNORecap.ts');
    expect(hook).toMatch(/const ready = progress\.isLoaded && progress\.loadedOwner === owner;/);
    expect(hook).toMatch(/if \(!ready\) return null;/);
    const store = fs.readFileSync(path.join(__dirname, '../../../store/useProgressStore.ts'), 'utf8');
    expect(store.match(/loadedOwner: /g)!.length).toBeGreaterThanOrEqual(6);
  });

  it('UserAvatar is the user; the Story Companion is only the guide line', () => {
    const screen = source('RecapScreen.tsx');
    expect(screen).toMatch(/<UserAvatar avatarConfig=\{avatarConfig\}/);
    expect(screen).not.toMatch(/<UserAvatar[^>]*characterId/);
    expect(screen).toMatch(/<StoryCompanion surface="recap"/);
    expect(screen).not.toMatch(/CharacterAvatar/);
  });

  it('analytics: event names only', () => {
    const screen = source('RecapScreen.tsx');
    expect(screen).toMatch(/track\('recap_opened'\)/);
    expect(screen).toMatch(/track\('recap_shared'\)/);
  });

  it('age presentation: one model - child fewer, larger cards; teen highlights first; adult editorial', () => {
    const recap = buildOYNORecap(ACTIVE);
    expect(presentMetrics(recap, 'child')).toHaveLength(4);
    expect(RECAP_PRESENTATION.child).toMatchObject({ cardSize: 'large', avatar: 'large' });
    expect(presentMetrics(recap, 'preteen')[0].id).toBe('achievements');
    expect(RECAP_PRESENTATION.teen.highlightsFirst).toBe(true);
    expect(RECAP_PRESENTATION.adult.editorial).toBe(true);
    expect(presentMetrics(recap, 'adult')).toHaveLength(recap.metrics.length);
  });

  it('KG / RU / EN strings', () => {
    for (const dict of [kg, ru, en]) {
      const recap = (dict as { recap: Record<string, unknown> }).recap;
      for (const key of ['title', 'allTime', 'mostPlayed', 'share', 'startStory']) expect(recap[key]).toBeTruthy();
      const labels = recap.label as Record<string, string>;
      for (const key of ['games', 'challenges', 'achievements', 'journal', 'saved']) expect(labels[key]).toBeTruthy();
    }
  });
});
