import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { EMPTY_RECORDS, recordInto } from '@/store/useGameRecordsStore';

import { GAME_RECORD_RULES, type GameSessionRecord } from '../records/gameRecords';
import { coachAdvice, coachWindow, COACH_RULES, COACHED_GAMES, MIN_ROUNDS } from './gameCoach';

let clock = 0;
const round = (gameId: string, fields: Partial<GameSessionRecord> = {}): GameSessionRecord => {
  clock += 1;
  return { id: `${gameId}:${clock}`, gameId, completedAt: new Date(Date.UTC(2026, 9, 1, 0, clock)).toISOString(), practice: false, result: 'completed', primary: 10, secondary: {}, ...fields };
};
const many = (n: number, make: () => GameSessionRecord) => Array.from({ length: n }, make).reverse();
const tipOf = (gameId: string, sessions: GameSessionRecord[]) => {
  const advice = coachAdvice(gameId, sessions);
  return advice.kind === 'tip' ? advice.tip.tipId : advice.kind;
};

describe('Game Coach', () => {
  it('covers every playable game that records real metrics (and no other)', () => {
    expect(COACHED_GAMES.sort()).toEqual(Object.keys(GAME_RECORD_RULES).sort());
  });

  describe('Jaa Atuu (accuracy, bullseyes)', () => {
    it('low accuracy -> aim first', () => expect(tipOf('jaa_atuu', many(3, () => round('jaa_atuu', { secondary: { accuracy: 40, bullseyes: 0, bestShot: 6 } })))).toBe('jaa_aim_first'));
    it('boundary: 50% average is not "low"', () => expect(tipOf('jaa_atuu', many(3, () => round('jaa_atuu', { secondary: { accuracy: 50, bullseyes: 1, bestShot: 9 } })))).toBe('none'));
    it('on target but never the center -> center tip', () => expect(tipOf('jaa_atuu', many(3, () => round('jaa_atuu', { secondary: { accuracy: 80, bullseyes: 0, bestShot: 8 } })))).toBe('jaa_center'));
    it('no false tip for a good player', () => expect(tipOf('jaa_atuu', many(5, () => round('jaa_atuu', { secondary: { accuracy: 90, bullseyes: 3, bestShot: 10 } })))).toBe('none'));
  });

  describe('Ordo (captures, result)', () => {
    it('few captures -> pull further', () => expect(tipOf('ordo', many(3, () => round('ordo', { result: 'loss', secondary: { captures: 0 } })))).toBe('ordo_pull_power'));
    it('captures fine but losing -> clear 3 first', () => expect(tipOf('ordo', many(3, () => round('ordo', { result: 'loss', secondary: { captures: 2 } })))).toBe('ordo_clear_three'));
    it('boundary: one loss in three is not a pattern', () => {
      expect(tipOf('ordo', [round('ordo', { result: 'loss', secondary: { captures: 2 } }), round('ordo', { result: 'win', secondary: { captures: 3 } }), round('ordo', { result: 'win', secondary: { captures: 3 } })])).toBe('none');
    });
  });

  it('Chuko: mostly losses -> pull further; wins -> nothing', () => {
    expect(tipOf('chuko', many(3, () => round('chuko', { result: 'loss' })))).toBe('chuko_pull_power');
    expect(tipOf('chuko', many(3, () => round('chuko', { result: 'win' })))).toBe('none');
  });

  it('Kyz Kuumai: she got away twice of three -> save sprint; catches -> nothing', () => {
    expect(tipOf('kyz_kuumai', [round('kyz_kuumai', { result: 'loss' }), round('kyz_kuumai', { result: 'loss' }), round('kyz_kuumai', { result: 'win', primary: 40 })])).toBe('kyz_save_sprint');
    expect(tipOf('kyz_kuumai', many(3, () => round('kyz_kuumai', { result: 'win', primary: 35 })))).toBe('none');
  });

  it('Kok Boru: no goals in three matches -> carry the ulak; any goal -> nothing', () => {
    expect(tipOf('kok_boru', many(3, () => round('kok_boru', { result: 'loss', primary: 0 })))).toBe('kok_carry_to_goal');
    expect(tipOf('kok_boru', [round('kok_boru', { primary: 1, result: 'draw' }), round('kok_boru', { primary: 0, result: 'loss' }), round('kok_boru', { primary: 0, result: 'loss' })])).toBe('none');
  });

  it('practice rounds are ignored (treated separately)', () => {
    const practice = many(5, () => round('chuko', { result: 'loss', practice: true }));
    expect(coachWindow(practice, 'chuko')).toEqual([]);
    expect(tipOf('chuko', practice)).toBe('first_time');
  });

  it('first time: the existing tutorial, no fake personalization; too few rounds -> nothing', () => {
    expect(tipOf('jaa_atuu', [])).toBe('first_time');
    expect(tipOf('ordo', many(MIN_ROUNDS - 1, () => round('ordo', { result: 'loss', secondary: { captures: 0 } })))).toBe('none');
  });

  it('invalid records are ignored', () => {
    const broken = [round('chuko', { result: 'loss', primary: Number.NaN }), round('chuko', { result: 'loss', completedAt: 'not-a-date' }), round('chuko', { result: 'loss' })];
    expect(coachWindow(broken, 'chuko')).toHaveLength(1);
  });

  it('deterministic: lowest priority wins, same input same tip; only the newest 5 rounds count', () => {
    const sessions = many(3, () => round('jaa_atuu', { secondary: { accuracy: 30, bullseyes: 0, bestShot: 3 } }));
    expect(tipOf('jaa_atuu', sessions)).toBe(tipOf('jaa_atuu', [...sessions].reverse()));
    const old = many(5, () => round('ordo', { result: 'loss', secondary: { captures: 0 } }));
    const recent = many(5, () => round('ordo', { result: 'win', secondary: { captures: 3 } }));
    expect(tipOf('ordo', [...old, ...recent])).toBe('none');
  });

  it('PB safety: coaching never changes records', () => {
    const { records } = recordInto(EMPTY_RECORDS, round('jaa_atuu', { primary: 30, secondary: { accuracy: 30, bullseyes: 0, bestShot: 3 } }));
    const before = JSON.stringify(records);
    coachAdvice('jaa_atuu', records.recent.jaa_atuu);
    expect(JSON.stringify(records)).toBe(before);
    const source = fs.readFileSync(path.join(__dirname, 'gameCoach.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    expect(source).not.toMatch(/useGameRecordsStore|record\(|setState|best\s*=/);
  });

  it('account isolation: the card reads the CURRENT owner’s records', () => {
    const card = fs.readFileSync(path.join(__dirname, 'GameCoachCard.tsx'), 'utf8');
    expect(card).toMatch(/useGameRecords\(\)/);
    expect(card).toMatch(/\$\{owner\}:\$\{gameId\}/);
  });

  it('analytics: only game_id + tip_id (no scores or history)', () => {
    const card = fs.readFileSync(path.join(__dirname, 'GameCoachCard.tsx'), 'utf8');
    for (const call of card.match(/track\([^)]*\)/g) ?? []) expect(call).toMatch(/\{ game_id: gameId, tip_id: (tipId|advice\.tip\.tipId) \}/);
  });

  it('KG / RU / EN tips exist for every rule, with no shaming words', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { gameCoach: { tips: Record<string, string>; short: Record<string, string>; replayTutorial: string } }).gameCoach;
      expect(block.replayTutorial).toBeTruthy();
      for (const rule of COACH_RULES) {
        expect(block.tips[rule.tipId]).toBeTruthy();
        expect(block.short[rule.tipId]).toBeTruthy();
      }
      expect(JSON.stringify(block)).not.toMatch(/bad|poor|failed|плохо|провал|начар/i);
    }
  });
});
