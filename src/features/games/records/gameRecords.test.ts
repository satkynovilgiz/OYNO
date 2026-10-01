import * as fs from 'fs';
import * as path from 'path';

import AsyncStorage from '@react-native-async-storage/async-storage';
import i18next from 'i18next';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { EMPTY_RECORDS, mergeRecords, ownerRecords, recordInto, summaryOf, useGameRecordsStore } from '@/store/useGameRecordsStore';

import { addRecent, applySession, formatMetric, GAME_RECORD_RULES, isBetter, makeSession, MAX_RECENT_SESSIONS, type GameSessionRecord } from './gameRecords';
import { buildPersonalBestShareCard } from './gameRecordsShare';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const GAMES = path.join(__dirname, '../../../games3d/games');
const round = (gameId: string, primary: number, extra: Partial<GameSessionRecord> = {}): GameSessionRecord =>
  makeSession(gameId, { practice: false, result: 'completed', primary, secondary: {}, ...extra }, new Date(Date.UTC(2026, 9, 1, 10, 0, 0) + primary * 1000));

describe('Game Records - rules', () => {
  it('every supported game states its rule explicitly', () => {
    expect(Object.fromEntries(Object.values(GAME_RECORD_RULES).map((rule) => [rule.gameId, rule.best]))).toEqual({
      jaa_atuu: 'higher',
      ordo: 'higher',
      chuko: 'higher',
      kyz_kuumai: 'lower',
      kok_boru: 'completion',
    });
  });

  it('higher is better: a higher score beats, an equal one is not a fake PB', () => {
    const rule = GAME_RECORD_RULES.jaa_atuu;
    expect(applySession(rule, 19, round('jaa_atuu', 24))).toEqual({ isNewBest: true, previousBest: 19, best: 24 });
    expect(applySession(rule, 24, round('jaa_atuu', 24))).toEqual({ isNewBest: false, previousBest: 24, best: 24 });
    expect(applySession(rule, 24, round('jaa_atuu', 10)).isNewBest).toBe(false);
  });

  it('lower is better (Kyz Kuumai): a faster catch beats; an escape never holds the best', () => {
    const rule = GAME_RECORD_RULES.kyz_kuumai;
    expect(applySession(rule, 40, round('kyz_kuumai', 35, { result: 'win' }))).toEqual({ isNewBest: true, previousBest: 40, best: 35 });
    expect(applySession(rule, 40, round('kyz_kuumai', 40, { result: 'win' })).isNewBest).toBe(false);
    expect(applySession(rule, 40, round('kyz_kuumai', 20, { result: 'loss' })).best).toBe(40);
    expect(isBetter(rule, 30, 40)).toBe(true);
  });

  it('completion only (Kok Boru): no numeric best ever', () => {
    expect(applySession(GAME_RECORD_RULES.kok_boru, null, round('kok_boru', 5, { result: 'win' }))).toEqual({ isNewBest: false, previousBest: null, best: null });
  });

  it('the first-ever best is set but not announced as "new" (nothing was beaten)', () => {
    expect(applySession(GAME_RECORD_RULES.ordo, null, round('ordo', 7))).toEqual({ isNewBest: false, previousBest: null, best: 7 });
  });

  it('practice is recorded and labelled, never the best', () => {
    const { records, outcome } = recordInto({ ...EMPTY_RECORDS, best: { jaa_atuu: 10 } }, round('jaa_atuu', 99, { practice: true }));
    expect(outcome.isNewBest).toBe(false);
    expect(records.best.jaa_atuu).toBe(10);
    expect(records.recent.jaa_atuu[0].practice).toBe(true);
  });

  it('recent history is capped, newest first', () => {
    let list: GameSessionRecord[] = [];
    for (let i = 0; i < 15; i++) list = addRecent(list, round('ordo', i));
    expect(list).toHaveLength(MAX_RECENT_SESSIONS);
    expect(list[0].primary).toBe(14);
  });

  it('games never compare with each other', () => {
    const { records } = recordInto(recordInto(EMPTY_RECORDS, round('jaa_atuu', 50)).records, round('ordo', 3));
    expect(summaryOf(records, 'jaa_atuu').best).toBe(50);
    expect(summaryOf(records, 'ordo').best).toBe(3);
  });
});

describe('Game Records - only finished rounds count', () => {
  it('each game records only from its RESULT phase (aborted/quit/paused/tutorial rounds never reach it)', () => {
    for (const file of ['jaa-atuu/JaaAtuuGame.tsx', 'ordo/OrdoGame.tsx', 'chuko/ChukoGame.tsx', 'kyz-kuumai/KyzKuumaiGame.tsx', 'kok-boru/KokBoruGame.tsx']) {
      const source = fs.readFileSync(path.join(GAMES, file), 'utf8');
      const calls = source.split('records.recordRound(').length - 1;
      expect(calls).toBe(1);
      const before = source.slice(0, source.indexOf('records.recordRound('));
      const effect = before.slice(before.lastIndexOf('useEffect('));
      expect(effect).toMatch(/game\.phase !== 'RESULT'/);
      expect(effect).toMatch(/recordedResultRef\.current = true/);
      expect(source).not.toMatch(/gameBestScore/);
    }
  });
});

describe('Game Records - storage and accounts', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useGameRecordsStore.setState({ isLoaded: false, saved: {} });
  });

  it('guest records persist on the device', async () => {
    await useGameRecordsStore.getState().load();
    useGameRecordsStore.getState().record('guest', round('ordo', 4));
    await new Promise((resolve) => setTimeout(resolve, 0));
    useGameRecordsStore.setState({ isLoaded: false, saved: {} });
    await useGameRecordsStore.getState().load();
    expect(ownerRecords(useGameRecordsStore.getState().saved, 'guest').best.ordo).toBe(4);
  });

  it('Guest -> A -> sign out -> B: B never sees A; guest rounds join the signed-in account', async () => {
    await useGameRecordsStore.getState().load();
    useGameRecordsStore.getState().record('guest', round('ordo', 4));
    useGameRecordsStore.getState().adoptGuest('user-a');
    useGameRecordsStore.getState().record('user-a', round('ordo', 9));
    const saved = useGameRecordsStore.getState().saved;
    expect(ownerRecords(saved, 'user-a').best.ordo).toBe(9);
    expect(ownerRecords(saved, 'user-a').sessions.ordo).toBe(2);
    expect(ownerRecords(saved, 'guest')).toEqual(EMPTY_RECORDS);
    expect(ownerRecords(saved, 'user-b')).toEqual(EMPTY_RECORDS);
  });

  it('screens select by the current owner (switches immediately with the account)', () => {
    const hook = fs.readFileSync(path.join(__dirname, 'useGameRecords.ts'), 'utf8');
    expect(hook).toMatch(/useAuthStore\(\(state\) => \(state\.status === 'authenticated' && state\.user\?\.id \? state\.user\.id : 'guest'\)\)/);
    expect(hook).toMatch(/ownerRecords\(saved, owner\)/);
  });

  it("old device-wide best scores become the current owner's bests, then retire", async () => {
    await AsyncStorage.setItem('oyno.account.owner', 'user-a');
    await AsyncStorage.setItem('games3d.bestScore.jaa_atuu', '42');
    await useGameRecordsStore.getState().load();
    expect(ownerRecords(useGameRecordsStore.getState().saved, 'user-a').best.jaa_atuu).toBe(42);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await AsyncStorage.getItem('games3d.bestScore.jaa_atuu')).toBeNull();
  });

  it('merge keeps the better best by each rule', () => {
    const merged = mergeRecords({ ...EMPTY_RECORDS, best: { kyz_kuumai: 40, ordo: 5 } }, { ...EMPTY_RECORDS, best: { kyz_kuumai: 30, ordo: 3 } });
    expect(merged.best).toEqual({ kyz_kuumai: 30, ordo: 5 });
  });
});

describe('Game Records - sharing and formatting', () => {
  it('the PB share card carries the game, the result and "Personal best" - nothing about the person', () => {
    const card = buildPersonalBestShareCard({ gameName: 'Jaa Atuu', valueText: '24 points', personalBestLabel: 'Personal best', listId: 'zhaa-atuu' });
    expect(card).toMatchObject({ title: 'Jaa Atuu', label: 'Personal best', subtitle: '24 points' });
    expect(Object.keys(card).sort()).toEqual(['fallbackTone', 'imageSource', 'label', 'subtitle', 'title']);
    expect(JSON.stringify(card)).not.toMatch(/@|user|email|uuid|diagnostic/i);
  });

  it('metrics format in KG / RU / EN', async () => {
    const instance = i18next.createInstance();
    await instance.init({ lng: 'en', resources: { en: { translation: en }, ru: { translation: ru }, kg: { translation: kg } }, interpolation: { escapeValue: false } });
    const t = (key: string, options?: Record<string, unknown>) => instance.t(key, options) as string;
    expect(formatMetric('points', 24, t)).toBe('24 points');
    expect(formatMetric('seconds', 65, t)).toBe('1:05');
    await instance.changeLanguage('ru');
    expect(formatMetric('points', 24, t)).toBe('24 очка');
    expect(formatMetric('points', 25, t)).toBe('25 очков');
    await instance.changeLanguage('kg');
    expect(formatMetric('points', 24, t)).toBe('24 упай');
    for (const dict of [kg, ru, en]) {
      const records = (dict as unknown as { gameRecords: Record<string, string> }).gameRecords;
      for (const key of ['yourRecords', 'personalBest', 'newPersonalBest', 'lastResult', 'gamesPlayed', 'recentGames', 'practice', 'playAgain', 'noRecords']) expect(records[key]).toBeTruthy();
    }
  });
});
