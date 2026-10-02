import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';

import { makeSession, type GameSessionRecord } from '../records/gameRecords';
import { beatsTarget, challengeableGames, challengeFromSession, challengePath, parseChallenge } from './friendChallenge';

jest.mock('expo-linking', () => ({ createURL: (path: string, options: { queryParams: Record<string, string> }) => `oyno://${path}?${new URLSearchParams(options.queryParams).toString()}` }));

const round = (gameId: string, primary: number, extra: Partial<GameSessionRecord> = {}) => makeSession(gameId, { practice: false, result: 'completed', primary, secondary: {}, ...extra });
const source = (file: string) => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('Friend challenge - links', () => {
  it('only games with a real comparable best are challengeable (not Kok Boru)', () => {
    expect(challengeableGames().sort()).toEqual(['chuko', 'jaa_atuu', 'kyz_kuumai', 'ordo']);
    expect(challengeFromSession(round('kok_boru', 3, { result: 'win' }))).toBeNull();
  });

  it('valid game link round-trips through the existing route', () => {
    const challenge = challengeFromSession(round('jaa_atuu', 24))!;
    expect(challenge).toEqual({ gameId: 'jaa_atuu', metric: 'score', target: 24 });
    expect(challengePath(challenge)).toEqual({ path: 'games/jaa-atuu', query: { challengeMetric: 'score', target: '24' } });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { challengeLink } = require('./friendChallengeShare') as typeof import('./friendChallengeShare');
    expect(challengeLink(challenge)).toBe('oyno://games/jaa-atuu?challengeMetric=score&target=24');
    expect(parseChallenge('jaa_atuu', { challengeMetric: 'score', target: '24' })).toEqual(challenge);
  });

  it('untrusted params: unknown game, wrong metric, NaN/infinite, negative, out of range -> null (never throws)', () => {
    expect(parseChallenge('space_invaders', { challengeMetric: 'score', target: '24' })).toBeNull();
    expect(parseChallenge('jaa_atuu', { challengeMetric: 'time', target: '24' })).toBeNull();
    expect(parseChallenge('kok_boru', { challengeMetric: 'score', target: '2' })).toBeNull();
    for (const target of ['NaN', 'Infinity', '-5', '0', '1e9', '24abc', '', '3.5']) expect(parseChallenge('jaa_atuu', { challengeMetric: 'score', target })).toBeNull();
    expect(parseChallenge('jaa_atuu', { challengeMetric: ['score'], target: { x: 1 } })).toBeNull();
    expect(parseChallenge('kyz_kuumai', { challengeMetric: 'time', target: '42.5' })).toEqual({ gameId: 'kyz_kuumai', metric: 'time', target: 42.5 });
  });
});

describe('Friend challenge - evaluation', () => {
  it('higher is better: strictly more beats the target (equal does not)', () => {
    const challenge = { gameId: 'jaa_atuu', metric: 'score' as const, target: 24 };
    expect(beatsTarget(challenge, round('jaa_atuu', 25))).toBe(true);
    expect(beatsTarget(challenge, round('jaa_atuu', 24))).toBe(false);
    expect(beatsTarget(challenge, round('jaa_atuu', 99, { practice: true }))).toBe(false);
  });

  it('lower is better (Kyz Kuumai): only a catch, and faster', () => {
    const challenge = { gameId: 'kyz_kuumai', metric: 'time' as const, target: 40 };
    expect(beatsTarget(challenge, round('kyz_kuumai', 35, { result: 'win' }))).toBe(true);
    expect(beatsTarget(challenge, round('kyz_kuumai', 30, { result: 'loss' }))).toBe(false);
    expect(challengeFromSession(round('kyz_kuumai', 30, { result: 'loss' }))).toBeNull();
    expect(challengeFromSession(round('kyz_kuumai', 30.04, { result: 'win' }))).toEqual({ gameId: 'kyz_kuumai', metric: 'time', target: 30 });
  });

  it('normal PB integration preserved: the challenge never writes the best itself', () => {
    const hook = fs.readFileSync(path.join(__dirname, '../records/useRoundRecords.ts'), 'utf8');
    expect(hook).toMatch(/void recordGameSession\(gameId, input\)/);
    expect(source('friendChallenge.ts')).not.toMatch(/useGameRecordsStore|record\(/);
    // Practice never launches a challenge (games pass it only in normal mode).
    for (const file of ['jaa-atuu/JaaAtuuGame.tsx', 'ordo/OrdoGame.tsx', 'chuko/ChukoGame.tsx', 'kyz-kuumai/KyzKuumaiGame.tsx']) {
      expect(fs.readFileSync(path.join(__dirname, '../../../games3d/games', file), 'utf8')).toMatch(/useRoundRecords\(GAME_ID, mode === 'normal' \? challenge : null\)/);
    }
  });
});

describe('Friend challenge - privacy and strings', () => {
  it('share card: game art, name, prompt - no sender identity; no backend', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { buildFriendChallengeCard } = require('./friendChallengeShare') as typeof import('./friendChallengeShare');
    const card = buildFriendChallengeCard({ gameName: 'Jaa Atuu', prompt: 'Can you beat 24 points?', listId: 'zhaa-atuu' });
    expect(Object.keys(card).sort()).toEqual(['fallbackTone', 'imageSource', 'label', 'title']);
    expect(JSON.stringify(card)).not.toMatch(/@|user|email|uuid/i);
    for (const file of ['friendChallenge.ts', 'friendChallengeShare.ts', 'useFriendChallengeParam.ts']) expect(source(file)).not.toMatch(/supabase|fetch\(/);
    for (const call of [...source('useFriendChallengeParam.ts').matchAll(/track\([^)]*\)/g)].map((match) => match[0])) expect(call).not.toMatch(/target:|user|email/);
  });

  it('KG / RU / EN strings', () => {
    for (const dict of [kg, ru, en]) {
      const block = (dict as unknown as { friendChallenge: Record<string, string> }).friendChallenge;
      for (const key of ['challengeFriend', 'canYouBeat', 'title', 'target', 'play', 'beaten', 'almost', 'share', 'invalid']) expect(block[key]).toBeTruthy();
    }
  });
});
