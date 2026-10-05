import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { EMPTY_RECORDS, ownerRecords, recordInto, type OwnerRecords } from '@/store/useGameRecordsStore';

import { GAME_RECORD_RULES, type GameSessionRecord } from '../records/gameRecords';
import { chartPoints, chartRange, chartSummary, gamesOverview, hasMetric, pbSessionId, recentSessions, RECENT_LIMIT, statsShare, summarize } from './gameStatsModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const ROOT = path.join(__dirname, '../../../..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
let n = 0;
const s = (gameId: string, primary: number, extra: Partial<GameSessionRecord> = {}): GameSessionRecord => {
  n += 1;
  return { id: `${gameId}:${n}`, gameId, completedAt: new Date(Date.UTC(2026, 9, 1, 0, n)).toISOString(), practice: false, result: 'completed', primary, secondary: {}, ...extra };
};
/** Feed rounds through the REAL store rule (recordInto) - no hand-made bests. */
const play = (sessions: GameSessionRecord[], start: OwnerRecords = EMPTY_RECORDS) => sessions.reduce((records, session) => recordInto(records, session).records, start);
const JAA = GAME_RECORD_RULES.jaa_atuu;
const KYZ = GAME_RECORD_RULES.kyz_kuumai;
const KOK = GAME_RECORD_RULES.kok_boru;

describe('Game Performance Lab - data', () => {
  it('official / practice / all filters; recent order is chronological (oldest -> newest)', () => {
    const records = play([s('jaa_atuu', 42), s('jaa_atuu', 30, { practice: true }), s('jaa_atuu', 51)]);
    expect(recentSessions(records, 'jaa_atuu', 'official').map((x) => x.primary)).toEqual([42, 51]);
    expect(recentSessions(records, 'jaa_atuu', 'practice').map((x) => x.primary)).toEqual([30]);
    expect(recentSessions(records, 'jaa_atuu', 'all').map((x) => x.primary)).toEqual([42, 30, 51]);
  });

  it('honest window: only the last 10 rounds exist, and the UI says "recent"', () => {
    const records = play(Array.from({ length: 14 }, (_, i) => s('ordo', i)));
    expect(recentSessions(records, 'ordo', 'all')).toHaveLength(RECENT_LIMIT);
    expect(en.gameStats.recentNote).toMatch(/Recent rounds - the last \{\{count\}\}/);
    expect(JSON.stringify([en.gameStats, ru.gameStats, kg.gameStats])).not.toMatch(/all-time|за всё время|бардык убакыт/i);
  });

  it('averages: plain deterministic mean (1 decimal) of real values', () => {
    expect(summarize(JAA, [s('jaa_atuu', 42), s('jaa_atuu', 51), s('jaa_atuu', 48)]).average).toBe(47);
    expect(summarize(JAA, [s('jaa_atuu', 1), s('jaa_atuu', 2)]).average).toBe(1.5);
    expect(summarize(JAA, []).average).toBeNull();
  });

  it('higher-is-better vs lower-is-better', () => {
    expect(summarize(JAA, [s('jaa_atuu', 42), s('jaa_atuu', 63)]).bestInView).toBe(63);
    expect(summarize(KYZ, [s('kyz_kuumai', 41, { result: 'win' }), s('kyz_kuumai', 35, { result: 'win' })]).bestInView).toBe(35);
    expect(en.gameStats.lowerIsBetter).toBe('Lower time is better');
    expect(read('src/features/games/stats/GameStatsScreens.tsx')).toContain("rule.best === 'lower' ? <Text style={styles.lowerBetter}>");
  });

  it('invalid metrics excluded: non-finite values, and Kyz Kuumai escapes have no comparable time', () => {
    expect(hasMetric(JAA, s('jaa_atuu', Number.NaN))).toBe(false);
    expect(hasMetric(JAA, s('jaa_atuu', -1))).toBe(false);
    expect(hasMetric(KYZ, s('kyz_kuumai', 60, { result: 'loss' }))).toBe(false);
    expect(hasMetric(KYZ, s('kyz_kuumai', 40, { result: 'win' }))).toBe(true);
    const points = chartPoints(KYZ, [s('kyz_kuumai', 40, { result: 'win' }), s('kyz_kuumai', 90, { result: 'loss' }), s('kyz_kuumai', 38, { result: 'win' })], null);
    expect(points.map((p) => p.value)).toEqual([40, 38]);
  });

  it('Kok Boru: no numeric PB, no chart line, W/D/L + recent goals from real rounds', () => {
    const sessions = [s('kok_boru', 3, { result: 'win' }), s('kok_boru', 1, { result: 'loss' }), s('kok_boru', 2, { result: 'draw' }), s('kok_boru', 4, { result: 'win' })];
    const records = play(sessions);
    expect(records.best.kok_boru).toBeUndefined();
    const summary = summarize(KOK, sessions);
    expect(summary).toMatchObject({ bestInView: null, average: null, wins: 2, draws: 1, losses: 1, goals: [3, 1, 2, 4] });
    expect(chartPoints(KOK, sessions, 9)).toEqual([]);
    expect(pbSessionId(KOK, sessions, 9)).toBeNull();
    expect(statsShare(KOK, records).best).toBeNull();
    expect(gamesOverview(records).find((g) => g.gameId === 'kok_boru')?.best).toBeNull();
  });

  it('practice never becomes PB, and the PB marker is the round that set the stored best', () => {
    const first = s('jaa_atuu', 40);
    const practiceHigh = s('jaa_atuu', 99, { practice: true });
    const beat = s('jaa_atuu', 55);
    const tie = s('jaa_atuu', 55);
    const records = play([first, practiceHigh, beat, tie]);
    expect(records.best.jaa_atuu).toBe(55);
    const all = recentSessions(records, 'jaa_atuu', 'all');
    expect(pbSessionId(JAA, all, records.best.jaa_atuu)).toBe(beat.id);
    const points = chartPoints(JAA, all, records.best.jaa_atuu);
    expect(points.filter((p) => p.isPb).map((p) => p.sessionId)).toEqual([beat.id]);
    expect(points.find((p) => p.sessionId === practiceHigh.id)).toMatchObject({ practice: true, isPb: false });
    // A best set before the recent window is not pinned on any recent round.
    expect(pbSessionId(JAA, [s('jaa_atuu', 10)], 80)).toBeNull();
  });

  it('chart input: real values in session order, no invented points, range from real min/max', () => {
    const sessions = [s('chuko', 5), s('chuko', 12), s('chuko', 9)];
    const points = chartPoints(GAME_RECORD_RULES.chuko, sessions, null);
    expect(points.map((p) => [p.index, p.value])).toEqual([[0, 5], [1, 12], [2, 9]]);
    const range = chartRange(points)!;
    expect(range.min).toBeLessThanOrEqual(5);
    expect(range.max).toBeGreaterThanOrEqual(12);
    expect(chartRange([])).toBeNull();
    expect(read('src/features/games/stats/GameStatsScreens.tsx').replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/bezier|curve|smooth|Path d=/i);
  });

  it('accessibility summary: "Last 5 official rounds: 42, 51, 48, 63, 60 points."', () => {
    const points = chartPoints(JAA, [42, 51, 48, 63, 60].map((v) => s('jaa_atuu', v)), null);
    const text = chartSummary(points, { lead: (count) => `Last ${count} official rounds`, format: String, unitSuffix: 'points' });
    expect(text).toBe('Last 5 official rounds: 42, 51, 48, 63, 60 points.');
    expect(read('src/features/games/stats/GameStatsScreens.tsx')).toContain('accessibilityLabel={summary}');
  });

  it('no cross-game score: overview is per game, never summed or compared', () => {
    const records = play([s('jaa_atuu', 42), s('ordo', 7, { result: 'win' })]);
    const overview = gamesOverview(records);
    expect(overview.map((g) => g.gameId)).toEqual(['jaa_atuu', 'ordo']);
    expect(overview.find((g) => g.gameId === 'jaa_atuu')?.wins).toBeNull();
    const source = read('src/features/games/stats/gameStatsModel.ts') + read('src/features/games/stats/GameStatsScreens.tsx');
    expect(source.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/overall|rating|leaderboard|rank|skill/i);
  });

  it('owner isolation: stats read only the current owner\'s records', () => {
    const saved = { 'user-a': play([s('ordo', 9)]), guest: EMPTY_RECORDS };
    expect(gamesOverview(ownerRecords(saved, 'user-b'))).toEqual([]);
    expect(gamesOverview(ownerRecords(saved, 'user-a'))).toHaveLength(1);
    expect(read('src/features/games/stats/GameStatsScreens.tsx')).toContain('const { records } = useGameRecords();');
  });

  it('share privacy: game title, real PB, recent official rounds, one safe metric; analytics game_id only', () => {
    const records = play([s('jaa_atuu', 42), s('jaa_atuu', 51)]);
    expect(statsShare(JAA, records)).toEqual({ best: 51, officialRecent: 2, average: 46.5 });
    const screen = read('src/features/games/stats/GameStatsScreens.tsx');
    expect(screen).toContain("track('game_stats_shared', { game_id: rule.gameId })");
    expect(screen).toContain("track('game_stats_game_opened', { game_id: rule.gameId })");
    expect(screen).toContain("track('game_stats_opened')");
    const shareBlock = screen.slice(screen.indexOf('function shareStats'), screen.indexOf('const tiles'));
    expect(shareBlock).not.toMatch(/user|email|owner|sessions\.map/);
  });

  it('routes, entries and KG/RU/EN copy', () => {
    for (const file of ['src/app/games/stats/index.tsx', 'src/app/games/stats/[gameId].tsx']) expect(fs.existsSync(path.join(ROOT, file))).toBe(true);
    expect(read('src/features/games/GamesScreen.tsx')).toContain("router.push('/games/stats' as never)");
    expect(read('src/features/profile/ProfileScreen.tsx')).toContain("route: '/games/stats'");
    for (const locale of [kg, ru, en]) for (const key of ['title', 'recentNote', 'lowerIsBetter', 'kokBoruNoBest', 'practiceNeverBest', 'share'] as const) expect(locale.gameStats[key]).toBeTruthy();
  });
});

// ---------------------------------------------------------------------
// Official vs practice are separate (Jaa Atuu: 5 arrows vs 15 arrows)
// ---------------------------------------------------------------------
describe('Game Performance Lab - official and practice kept apart', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { roundGroups, chartDescription, formatAggregate, statsShare: share } = require('./gameStatsModel') as typeof import('./gameStatsModel');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { formatMetric } = require('../records/gameRecords') as typeof import('../records/gameRecords');
  const mixed = () => play([s('jaa_atuu', 40), s('jaa_atuu', 120, { practice: true }), s('jaa_atuu', 50), s('jaa_atuu', 150, { practice: true })]);

  it('the game really differs: official rounds have 5 arrows, practice 15', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const types = require('@/games3d/games/jaa-atuu/JaaAtuuTypes') as { TOTAL_ARROWS: number; PRACTICE_ARROWS: number };
    expect(types.TOTAL_ARROWS).toBe(5);
    expect(types.PRACTICE_ARROWS).toBe(15);
  });

  it('a mixed dataset under "All" gives two separate summaries, never one combined average', () => {
    const records = mixed();
    const groups = roundGroups(JAA, records, 'all', records.best.jaa_atuu ?? null);
    expect(groups.map((g) => g.type)).toEqual(['official', 'practice']);
    expect(groups[0].summary).toMatchObject({ rounds: 2, average: 45 });
    expect(groups[1].summary).toMatchObject({ rounds: 2, average: 135 });
    // The combined mean (90) appears nowhere.
    expect(groups.map((g) => g.summary.average)).not.toContain(90);
    // Two separate trends: no chart mixes types.
    expect(groups[0].points.every((p) => !p.practice)).toBe(true);
    expect(groups[1].points.every((p) => p.practice)).toBe(true);
  });

  it('"Official" and "Practice" filters each compute their own group', () => {
    const records = mixed();
    const official = roundGroups(JAA, records, 'official', records.best.jaa_atuu ?? null);
    const practice = roundGroups(JAA, records, 'practice', records.best.jaa_atuu ?? null);
    expect(official.map((g) => [g.type, g.summary.average])).toEqual([['official', 45]]);
    expect(practice.map((g) => [g.type, g.summary.average])).toEqual([['practice', 135]]);
  });

  it('practice scores never receive a PB marker, even when higher than the official best', () => {
    const records = mixed();
    expect(records.best.jaa_atuu).toBe(50);
    const [official, practice] = roundGroups(JAA, records, 'all', 50);
    expect(official.points.filter((p) => p.isPb)).toHaveLength(1);
    expect(practice.points.some((p) => p.isPb)).toBe(false);
  });

  it('empty groups and a single round', () => {
    const onlyOfficial = play([s('jaa_atuu', 42)]);
    expect(roundGroups(JAA, onlyOfficial, 'all', 42).map((g) => g.type)).toEqual(['official']);
    const practiceView = roundGroups(JAA, onlyOfficial, 'practice', 42);
    expect(practiceView).toHaveLength(1);
    expect(practiceView[0].summary).toMatchObject({ rounds: 0, average: null });
    const single = roundGroups(JAA, onlyOfficial, 'official', 42)[0];
    expect(single.points).toHaveLength(1);
    // A single round still gets a text description (no chart needs 2 points), without an "average" of one.
    const text = chartDescription(single.points, { lead: (count) => `Last ${count} official round`, format: String, unitSuffix: 'points', average: 'Average: 42.' });
    expect(text).toBe('Last 1 official round: 42 points.');
  });

  it('chart descriptions name the round type (KG/RU/EN) and add the average', () => {
    for (const locale of [kg, ru, en] as unknown as { gameStats: { chartLead: Record<string, string>; avg: Record<string, string>; group: Record<string, string>; chartTitle: Record<string, string>; separateNote: string; averageSentence: string } }[]) {
      for (const type of ['official', 'practice']) {
        expect(locale.gameStats.chartLead[`${type}_other`]).toBeTruthy();
        expect(locale.gameStats.avg[type]).toBeTruthy();
        expect(locale.gameStats.group[type]).toBeTruthy();
        expect(locale.gameStats.chartTitle[type]).toBeTruthy();
      }
      expect(locale.gameStats.separateNote).toBeTruthy();
      expect(locale.gameStats.averageSentence).toContain('{{value}}');
    }
    const [, practice] = roundGroups(JAA, mixed(), 'all', 50);
    const lead = en.gameStats.chartLead.practice_other.replace('{{count}}', '2');
    expect(chartDescription(practice.points, { lead: () => lead, format: String, unitSuffix: 'points', average: 'Average: 135.' })).toBe('Last 2 practice rounds: 120, 150 points. Average: 135.');
  });

  it('Kok Boru practice "scored" flags (1/0) never count as goals', () => {
    const records = play([s('kok_boru', 3, { result: 'win' }), s('kok_boru', 1, { practice: true, result: 'completed' }), s('kok_boru', 0, { practice: true, result: 'completed' })]);
    const groups = roundGroups(KOK, records, 'all', null);
    expect(groups[0].summary.goals).toEqual([3]);
    expect(groups[1].summary.goals).toEqual([]);
    expect(groups[1].summary.wins + groups[1].summary.draws + groups[1].summary.losses).toBe(0);
  });

  it('shared stats stay comparable: official rounds only, labelled as official', () => {
    const data = share(JAA, mixed());
    expect(data).toEqual({ best: 50, officialRecent: 2, average: 45 });
    expect(en.gameStats.avg.official).toBe('Official average');
  });

  // -------------------------------------------------------------------
  // Averages keep their precision (Task: 10 and 11 -> 10.5, not 11)
  // -------------------------------------------------------------------
  const t = ((key: string, options?: Record<string, unknown>) => `${key}:${JSON.stringify(options)}`) as never;

  it('scores 10 and 11 display an average of 10.5 in English', () => {
    const [official] = roundGroups(JAA, play([s('jaa_atuu', 10), s('jaa_atuu', 11)]), 'official', 11);
    expect(official.summary.average).toBe(10.5);
    expect(formatAggregate('points', official.summary.average, 'en')).toBe('10.5');
  });

  it('Russian uses its decimal separator; Kyrgyz formats too', () => {
    expect(formatAggregate('points', 10.5, 'ru')).toBe('10,5');
    expect(formatAggregate('points', 10.5, 'kg')).toMatch(/^10[.,]5$/);
  });

  it('integer averages have no trailing decimals; long values keep one decimal', () => {
    expect(formatAggregate('points', 47, 'en')).toBe('47');
    expect(formatAggregate('points', 47.04, 'en')).toBe('47');
    expect(formatAggregate('points', 46.75, 'en')).toBe('46.8');
    expect(formatAggregate('points', 1234.5, 'en')).toBe('1234.5');
  });

  it('times keep the same one-decimal precision as m:ss.s', () => {
    expect(formatAggregate('seconds', 41.25, 'en')).toBe('0:41.3');
    expect(formatAggregate('seconds', 65, 'en')).toBe('1:05');
    expect(formatAggregate('seconds', 61.5, 'ru')).toBe('1:01,5');
  });

  it('empty / invalid input never shows a fabricated average', () => {
    expect(formatAggregate('points', null, 'en')).toBeNull();
    expect(formatAggregate('points', undefined, 'en')).toBeNull();
    expect(formatAggregate('points', Number.NaN, 'en')).toBeNull();
    expect(formatAggregate('points', -1, 'en')).toBeNull();
    expect(formatAggregate('points', 0, 'en')).toBe('0');
    expect(roundGroups(JAA, EMPTY_RECORDS, 'official', null)[0].summary.average).toBeNull();
  });

  it('individual result formatting is unchanged', () => {
    expect(formatMetric('points', 10.5, t)).toBe('gameRecords.unit.points:{"count":11}');
    expect(formatMetric('seconds', 41.25, t)).toBe('gameRecords.unit.time:{"time":"0:41"}');
  });

  it('the shared average equals the official summary\'s displayed average', () => {
    const records = play([s('jaa_atuu', 10), s('jaa_atuu', 11), s('jaa_atuu', 99, { practice: true })]);
    const [official] = roundGroups(JAA, records, 'official', records.best.jaa_atuu ?? null);
    expect(formatAggregate('points', share(JAA, records).average, 'en')).toBe(formatAggregate('points', official.summary.average, 'en'));
    expect(formatAggregate('points', share(JAA, records).average, 'en')).toBe('10.5');
  });
});
