/**
 * Durable "official round finished" signal for Learning Path game steps and
 * the Portfolio. Recent history keeps only 10 rounds - a completed step
 * must not become incomplete when practice rounds push the official one out.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { MAX_RECENT_SESSIONS, makeSession, type GameSessionRecord } from '@/features/games/records/gameRecords';
import { pathProgress, type LearningPath, type PathSignals } from '@/features/learn/learningPaths';
import { buildPortfolio } from '@/features/profile/portfolio/portfolioModel';
import { gameRecordRules } from '@/services/sync/privateSync/domains';

import { EMPTY_RECORDS, GAME_RECORDS_KEY, mergeRecords, officialRounds, ownerRecords, recordInto, useGameRecordsStore, type OwnerRecords } from './useGameRecordsStore';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

let clock = Date.UTC(2026, 9, 5);
const round = (gameId: string, practice: boolean, extra: Partial<GameSessionRecord> = {}) => {
  clock += 60_000;
  return makeSession(gameId, { practice, result: practice ? 'completed' : 'loss', primary: 3, secondary: {}, ...extra }, new Date(clock));
};
const play = (sessions: GameSessionRecord[], start: OwnerRecords = EMPTY_RECORDS) => sessions.reduce((records, session) => recordInto(records, session).records, start);

// A path whose only step is a game (as LEARNING_PATHS steps are).
const PATH: LearningPath = { id: 'horse', titleKey: 't', descriptionKey: 'd', heroItemId: null, steps: [{ id: 'play', type: 'game', targetId: 'kok_boru' }] };
const signalsFor = (records: OwnerRecords): PathSignals => ({
  readingCompleted: () => false,
  readingStarted: () => false,
  glossaryGotIt: () => false,
  glossarySeen: () => false,
  challengeCompleted: () => false,
  challengeStarted: () => false,
  // Exactly what usePathSignals does.
  gamePlayed: (id) => officialRounds(records, id) > 0,
  labFlag: () => false,
  manualCompleted: () => false,
});

describe('durable official-round signal', () => {
  it('one official round, then enough practice to evict it from history: the step stays completed', () => {
    const records = play([round('kok_boru', false), ...Array.from({ length: MAX_RECENT_SESSIONS + 2 }, () => round('kok_boru', true))]);
    expect(records.recent.kok_boru.every((session) => session.practice)).toBe(true);
    expect(officialRounds(records, 'kok_boru')).toBe(1);
    expect(pathProgress(PATH, signalsFor(records)).done).toBe(true);
  });

  it('practice-only history never completes the step', () => {
    const records = play(Array.from({ length: 4 }, () => round('kok_boru', true)));
    expect(records.sessions.kok_boru).toBe(4);
    expect(officialRounds(records, 'kok_boru')).toBe(0);
    expect(pathProgress(PATH, signalsFor(records)).done).toBe(false);
  });

  it('a lost official match counts (completion, not winning); Kok Boru has no PB to lean on', () => {
    const records = play([round('kok_boru', false, { result: 'loss' })]);
    expect(records.best.kok_boru).toBeUndefined();
    expect(records.wins.kok_boru).toBeUndefined();
    expect(officialRounds(records, 'kok_boru')).toBe(1);
  });

  it('survives an app restart (persisted with the records)', async () => {
    await AsyncStorage.clear();
    useGameRecordsStore.setState({ isLoaded: false, saved: {} });
    await useGameRecordsStore.getState().load();
    useGameRecordsStore.getState().record('user-a', round('kok_boru', false));
    for (let i = 0; i < MAX_RECENT_SESSIONS + 1; i += 1) useGameRecordsStore.getState().record('user-a', round('kok_boru', true));
    await new Promise((resolve) => setTimeout(resolve, 0));
    // "Restart": a fresh store reading what was stored.
    useGameRecordsStore.setState({ isLoaded: false, saved: {} });
    expect(await AsyncStorage.getItem(GAME_RECORDS_KEY)).not.toBeNull();
    await useGameRecordsStore.getState().load();
    const records = ownerRecords(useGameRecordsStore.getState().saved, 'user-a');
    expect(records.recent.kok_boru.some((session) => !session.practice)).toBe(false);
    expect(officialRounds(records, 'kok_boru')).toBe(1);
  });

  it('switching accounts does not share completion', () => {
    const saved = { 'user-a': play([round('kok_boru', false)]), 'user-b': play([round('kok_boru', true)]) };
    expect(officialRounds(ownerRecords(saved, 'user-a'), 'kok_boru')).toBe(1);
    expect(officialRounds(ownerRecords(saved, 'user-b'), 'kok_boru')).toBe(0);
    expect(officialRounds(ownerRecords(saved, 'guest'), 'kok_boru')).toBe(0);
  });

  it('guest -> account adoption adds the two owners\' official rounds', () => {
    const merged = mergeRecords(play([round('ordo', false)]), play([round('ordo', false), round('ordo', true)]));
    expect(officialRounds(merged, 'ordo')).toBe(2);
  });
});

describe('older records (no stored count): only reliable evidence', () => {
  const legacy = (records: Partial<OwnerRecords>): OwnerRecords => ({ recent: {}, best: {}, sessions: {}, wins: {}, ...records });

  it('no evidence -> no fabricated completion (rounds played may include practice)', () => {
    expect(officialRounds(legacy({ sessions: { jaa_atuu: 9 }, recent: { jaa_atuu: [round('jaa_atuu', true)] } }), 'jaa_atuu')).toBe(0);
    expect(officialRounds(legacy({}), 'jaa_atuu')).toBe(0);
  });

  it('a stored PB, an official win, or an official round still in history is evidence', () => {
    expect(officialRounds(legacy({ best: { jaa_atuu: 41 } }), 'jaa_atuu')).toBe(1);
    expect(officialRounds(legacy({ wins: { ordo: 2 } }), 'ordo')).toBe(1);
    expect(officialRounds(legacy({ recent: { chuko: [round('chuko', false), round('chuko', false), round('chuko', true)] } }), 'chuko')).toBe(2);
  });

  it('the first new round after upgrading persists the inferred count before history can be trimmed', () => {
    const upgraded = play([round('jaa_atuu', true)], legacy({ best: { jaa_atuu: 41 } }));
    expect(upgraded.official?.jaa_atuu).toBe(1);
  });
});

describe('sync keeps the signal', () => {
  it('validates with or without the field (older app versions)', () => {
    const base = { best: null, recent: [], sessions: 3, wins: 0 };
    expect(gameRecordRules.validate({ ...base, official: 2 })).toMatchObject({ official: 2 });
    expect(gameRecordRules.validate(base)).not.toHaveProperty('official');
  });

  it('a record from an older app (no field) never erases the count', () => {
    const local = { best: null, recent: [], sessions: 5, wins: 0, official: 1 };
    const server = { best: null, recent: [], sessions: 5, wins: 0 };
    expect(gameRecordRules.merge(null, local, server, 'kok_boru').official).toBe(1);
    expect(gameRecordRules.merge(null, server, local, 'kok_boru').official).toBe(1);
  });
});

describe('Portfolio uses the same signal', () => {
  it('official rounds reported even after practice evicted them from history', () => {
    const records = play([round('kok_boru', false), ...Array.from({ length: 12 }, () => round('kok_boru', true))]);
    const portfolio = buildPortfolio({
      signals: signalsFor(records),
      paths: [PATH],
      challengeResults: {},
      reading: {},
      readingExists: () => true,
      study: {},
      records,
      earnedAchievementIds: [],
      pinnedAchievementIds: [],
    });
    expect(portfolio.games.find((game) => game.gameId === 'kok_boru')).toMatchObject({ rounds: 13, officialRounds: 1 });
    expect(portfolio.completedPaths.map((path) => path.id)).toEqual(['horse']);
  });
});
