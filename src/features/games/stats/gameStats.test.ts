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
