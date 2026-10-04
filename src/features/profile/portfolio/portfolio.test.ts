import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import type { LearningPath, PathSignals } from '@/features/learn/learningPaths';
import { EMPTY_RECORDS, ownerRecords, type OwnerRecords } from '@/store/useGameRecordsStore';

import { buildPortfolio, DEFAULT_SHARE, pathA11yLabel, portfolioShare, SHAREABLE_CATEGORIES, type PortfolioInput } from './portfolioModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const ROOT = path.join(__dirname, '../../../..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const none: PathSignals = {
  readingCompleted: () => false,
  readingStarted: () => false,
  glossaryGotIt: () => false,
  glossarySeen: () => false,
  challengeCompleted: () => false,
  challengeStarted: () => false,
  gamePlayed: () => false,
  labFlag: () => false,
  manualCompleted: () => false,
};
const PATHS: LearningPath[] = [
  { id: 'boz-uy', titleKey: 'paths.boz', descriptionKey: 'd', heroItemId: 'boz-uy-overview', steps: [{ id: 'a', type: 'culture_item', targetId: 'boz-uy-overview' }, { id: 'b', type: 'culture_item', targetId: 'boz-uy-karkas' }] },
  { id: 'felt', titleKey: 'paths.felt', descriptionKey: 'd', heroItemId: null, steps: [{ id: 'a', type: 'culture_item', targetId: 'shyrdak-craft' }, { id: 'b', type: 'glossary', targetId: 'shyrdak' }] },
  { id: 'horse', titleKey: 'paths.horse', descriptionKey: 'd', heroItemId: null, steps: [{ id: 'a', type: 'culture_item', targetId: 'horse-overview' }] },
];
const at = '2026-10-01T10:00:00.000Z';
const base: PortfolioInput = { signals: none, paths: PATHS, challengeResults: {}, reading: {}, readingExists: () => true, study: {}, records: EMPTY_RECORDS, earnedAchievementIds: [], pinnedAchievementIds: [] };

const RECORDS: OwnerRecords = {
  recent: {},
  best: { jaa_atuu: 63, kyz_kuumai: 41.2, kok_boru: 5 },
  sessions: { jaa_atuu: 7, kyz_kuumai: 3, kok_boru: 4 },
  wins: { kyz_kuumai: 2, kok_boru: 1, jaa_atuu: 9 },
};

describe('Portfolio - derivation', () => {
  it('empty state for a new person', () => {
    const portfolio = buildPortfolio(base);
    expect(portfolio.isEmpty).toBe(true);
    expect(en.portfolio.empty).toBe('Your learning will appear here as you explore OYNO.');
  });

  it('completed path and active path (steps from the real path progress)', () => {
    const signals = { ...none, readingCompleted: (id: string) => ['boz-uy-overview', 'boz-uy-karkas', 'shyrdak-craft'].includes(id), readingStarted: () => true };
    const portfolio = buildPortfolio({ ...base, signals });
    expect(portfolio.completedPaths.map((p) => [p.id, p.completed, p.total])).toEqual([['boz-uy', 2, 2]]);
    expect(portfolio.activePaths.map((p) => [p.id, p.completed, p.total])).toEqual([['felt', 1, 2], ['horse', 0, 1]]);
  });

  it('unknown completion date is omitted: the model carries no date for paths, games or glossary', () => {
    const portfolio = buildPortfolio({ ...base, signals: { ...none, readingCompleted: () => true } });
    expect(JSON.stringify(portfolio.completedPaths)).not.toMatch(/At"|date|\d{4}-\d{2}-\d{2}/i);
    const screen = read('src/features/profile/portfolio/PortfolioScreen.tsx');
    expect(screen).not.toMatch(/toLocaleDateString|formatEntryDate|createdAt|installed/);
  });

  it('quiz best score + attempts from the existing challenge results (topic quizzes only, completed only)', () => {
    const portfolio = buildPortfolio({
      ...base,
      challengeResults: {
        'topic:boz-uy': { startedAt: at, completedAt: at, lastCorrect: 4, lastTotal: 6, bestCorrect: 5, attempts: 2 },
        'topic:komuz': { startedAt: at, completedAt: null, lastCorrect: 0, lastTotal: 0, bestCorrect: 0, attempts: 0 },
        'collection:horse-culture': { startedAt: at, completedAt: at, lastCorrect: 3, lastTotal: 5, bestCorrect: 3, attempts: 1 },
      },
    });
    expect(portfolio.quizzes).toEqual([expect.objectContaining({ id: 'boz-uy', best: 5, lastTotal: 6, attempts: 2 })]);
    expect(JSON.stringify(portfolio.quizzes)).not.toMatch(/question|answer|wrong|mistake/i);
  });

  it('reading counts (stale content skipped) and at most 3 recent titles', () => {
    const record = (id: string, completedAt: string | null) => ({ contentType: 'culture_item' as const, contentId: id, progress: 1, furthest: 1, lastReadAt: at, completedAt });
    const reading = Object.fromEntries(
      [record('a', '2026-10-01T00:00:00Z'), record('b', '2026-10-02T00:00:00Z'), record('c', '2026-10-03T00:00:00Z'), record('d', '2026-10-04T00:00:00Z'), record('e', null), record('gone', at)].map((r) => [`culture_item:${r.contentId}`, r]),
    );
    const portfolio = buildPortfolio({ ...base, reading, readingExists: (_type, id) => id !== 'gone' });
    expect(portfolio.reading).toEqual({ completed: 4, inProgress: 1, recentlyCompletedIds: ['d', 'c', 'b'] });
  });

  it('glossary counts: studied / got it / needs review (unknown entries ignored)', () => {
    const study = {
      tunduk: { glossaryEntryId: 'tunduk', seenCount: 2, gotItCount: 1, reviewAgainCount: 1, lastReviewedAt: at, needsReview: false },
      kerege: { glossaryEntryId: 'kerege', seenCount: 1, gotItCount: 0, reviewAgainCount: 1, lastReviewedAt: at, needsReview: true },
      removed: { glossaryEntryId: 'removed', seenCount: 1, gotItCount: 1, reviewAgainCount: 0, lastReviewedAt: at, needsReview: false },
    };
    expect(buildPortfolio({ ...base, study }).glossary).toEqual({ studied: 2, gotIt: 1, needsReview: 1 });
  });

  it('game rule differences: higher vs lower best, wins only where meaningful', () => {
    const games = buildPortfolio({ ...base, records: RECORDS }).games;
    const jaa = games.find((g) => g.gameId === 'jaa_atuu')!;
    const kyz = games.find((g) => g.gameId === 'kyz_kuumai')!;
    expect(jaa).toMatchObject({ best: 63, bestRule: 'higher', rounds: 7, wins: null });
    expect(kyz).toMatchObject({ best: 41.2, bestRule: 'lower', wins: 2 });
  });

  it('Kok Boru: no numeric personal best, ever (even if a stray value exists)', () => {
    const kok = buildPortfolio({ ...base, records: RECORDS }).games.find((g) => g.gameId === 'kok_boru')!;
    expect(kok.best).toBeNull();
    expect(kok.bestRule).toBeNull();
    expect(kok.wins).toBe(1);
  });

  it('achievements: existing earned ids only, showcase pins first', () => {
    const portfolio = buildPortfolio({ ...base, earnedAchievementIds: ['a', 'b', 'c'], pinnedAchievementIds: ['c', 'x'] });
    expect(portfolio.achievements).toEqual({ pinned: ['c'], earned: ['c', 'a', 'b'] });
  });

  it('owner isolation + guest: the screen derives everything from the CURRENT owner', () => {
    const saved = { guest: RECORDS, 'user-a': { ...EMPTY_RECORDS, sessions: { ordo: 2 } } };
    expect(buildPortfolio({ ...base, records: ownerRecords(saved, 'user-b') }).games).toEqual([]);
    expect(buildPortfolio({ ...base, records: ownerRecords(saved, 'guest') }).games.length).toBe(3);
    const screen = read('src/features/profile/portfolio/PortfolioScreen.tsx');
    for (const scoped of ['usePathSignals()', 'ownerReading(', 'ownerStudy(', 'useGameRecords()', 'ownerPins(']) expect(screen).toContain(scoped);
    // Achievements only when the loaded progress belongs to this owner.
    expect(screen).toContain('progressOwner === owner ? unlocked');
    // No new store, no sync domain.
    expect(screen).not.toMatch(/\bcreate<|zustand|AsyncStorage/);
  });
});

describe('Portfolio - share privacy', () => {
  const full = buildPortfolio({
    ...base,
    signals: { ...none, readingCompleted: () => true },
    challengeResults: { 'topic:boz-uy': { startedAt: at, completedAt: at, lastCorrect: 5, lastTotal: 6, bestCorrect: 5, attempts: 2 } },
    records: RECORDS,
    earnedAchievementIds: ['a', 'b'],
    study: { tunduk: { glossaryEntryId: 'tunduk', seenCount: 1, gotItCount: 1, reviewAgainCount: 0, lastReviewedAt: at, needsReview: false } },
  });

  it('defaults: all safe categories on; never journal/notes/mistakes/reading/glossary/identity', () => {
    expect(SHAREABLE_CATEGORIES).toEqual(['paths', 'quizzes', 'achievements', 'games']);
    expect(DEFAULT_SHARE).toEqual({ paths: true, quizzes: true, achievements: true, games: true });
    const share = portfolioShare(full, DEFAULT_SHARE);
    expect(share.lines.map((line) => line.key)).toEqual(['paths', 'quizzes', 'achievements', 'games']);
    expect(JSON.stringify(share)).not.toMatch(/journal|note|mistake|reading|glossary|email|user|owner|best|tunduk/i);
  });

  it('only what the person keeps switched on; featured titles max 3; no rank', () => {
    const share = portfolioShare(full, { paths: false, quizzes: true, achievements: false, games: false });
    expect(share.lines).toEqual([{ key: 'quizzes', count: 1 }]);
    expect(share.featured.every((entry) => entry.kind === 'quiz')).toBe(true);
    expect(portfolioShare(full, DEFAULT_SHARE).featured.length).toBeLessThanOrEqual(3);
    const screen = read('src/features/profile/portfolio/PortfolioScreen.tsx');
    expect(screen).toContain("variant: 'summary'");
    expect(screen.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')).not.toMatch(/\b(rank|ranking|xp|level|leaderboard)\b/i);
    expect(screen).toMatch(/track\('learning_portfolio_shared'\)/);
    expect(screen).toMatch(/track\('learning_portfolio_opened'\)/);
  });
});

describe('Portfolio - route, a11y, KG/RU/EN', () => {
  it('route + profile entry', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/app/profile/portfolio.tsx'))).toBe(true);
    expect(read('src/features/profile/ProfileScreen.tsx')).toContain("route: '/profile/portfolio'");
  });

  it('"Boz Üy Learning Path. Completed. 5 of 5 steps."', () => {
    const label = pathA11yLabel('Boz Üy', { id: 'boz-uy', titleKey: '', heroItemId: null, completed: 5, total: 5, done: true }, { learningPath: 'Learning Path', completed: 'Completed', inProgress: 'In progress', steps: (d, t) => `${d} of ${t} steps` });
    expect(label).toBe('Boz Üy Learning Path. Completed. 5 of 5 steps.');
  });

  it('all copy exists in KG/RU/EN', () => {
    for (const locale of [kg, ru, en] as unknown as { portfolio: Record<string, unknown> }[]) {
      for (const key of ['title', 'empty', 'startLearning', 'completed', 'inProgress', 'share', 'shareNever']) expect(locale.portfolio[key]).toBeTruthy();
      for (const section of ['paths', 'quizzes', 'reading', 'glossary', 'games', 'achievements']) expect((locale.portfolio.sections as Record<string, string>)[section]).toBeTruthy();
    }
  });
});
