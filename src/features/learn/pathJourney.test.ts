/**
 * Guided journey through a Learning Path: which screen has path context,
 * and what "Continue learning" offers after a step - derived from the same
 * signals as the path screen (no second progress engine).
 */
import * as fs from 'fs';
import * as path from 'path';

import { makeSession } from '@/features/games/records/gameRecords';
import { EMPTY_RECORDS, officialRounds, recordInto } from '@/store/useGameRecordsStore';

import { LEARNING_PATHS, pathContextFor, pathContextValid, pathContinuation, pathProgress, type LearningPath, type PathSignals } from './learningPaths';
import { gameRouteFor } from './useStepDisplay';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const BOZ_UY = LEARNING_PATHS.find((candidate) => candidate.id === 'boz-uy')!;
const HORSE = LEARNING_PATHS.find((candidate) => candidate.id === 'horse-games')!;

/** Signals from plain sets of finished things (what the stores record). */
const signals = (done: { read?: string[]; started?: string[]; gotIt?: string[]; challenges?: string[]; games?: (id: string) => boolean; manual?: string[] } = {}): PathSignals => ({
  readingCompleted: (id) => !!done.read?.includes(id),
  readingStarted: (id) => !!done.read?.includes(id) || !!done.started?.includes(id),
  glossaryGotIt: (id) => !!done.gotIt?.includes(id),
  glossarySeen: (id) => !!done.gotIt?.includes(id),
  challengeCompleted: (id) => !!done.challenges?.includes(id),
  challengeStarted: (id) => !!done.challenges?.includes(id),
  gamePlayed: (id) => done.games?.(id) ?? false,
  labFlag: () => false,
  manualCompleted: (pathId, stepId) => !!done.manual?.includes(`${pathId}/${stepId}`),
});

describe('path context: only a step opened FROM its path', () => {
  it('a step route opened from the path has context with its index', () => {
    expect(pathContextFor('boz-uy', '/culture/item/boz-uy-karkas', gameRouteFor)).toEqual({ path: BOZ_UY, stepIndex: 1 });
    expect(pathContextFor('horse-games', '/games/kok-boru', gameRouteFor)).toEqual({ path: HORSE, stepIndex: 1 });
  });

  it('a direct link (no fromPath) never gets a path', () => {
    expect(pathContextFor(undefined, '/culture/item/boz-uy-karkas', gameRouteFor)).toBeNull();
  });

  it('an unrelated path or a screen that is not one of its steps gets nothing', () => {
    expect(pathContextFor('horse-games', '/culture/item/boz-uy-karkas', gameRouteFor)).toBeNull();
    expect(pathContextFor('boz-uy', '/culture/item/boz-uy-karkas/related', gameRouteFor)).toBeNull();
    expect(pathContextFor('no-such-path', '/culture/item/boz-uy-karkas', gameRouteFor)).toBeNull();
  });

  it('another account after a switch does not inherit the journey', () => {
    expect(pathContextValid('guest', 'guest')).toBe(true);
    expect(pathContextValid('user-a', 'user-b')).toBe(false);
  });
});

describe('Continue learning', () => {
  it('opening a step offers nothing - only real completion does', () => {
    expect(pathContinuation(BOZ_UY, 0, signals({ started: ['boz-uy-overview'] }))).toEqual({ kind: 'pending' });
  });

  it('article completion offers the next incomplete step', () => {
    expect(pathContinuation(BOZ_UY, 0, signals({ read: ['boz-uy-overview'] }))).toMatchObject({ kind: 'next', index: 1, step: { targetId: 'boz-uy-karkas' } });
  });

  it('completed steps are skipped', () => {
    // Frame article and the term are already done -> the builder lab is next.
    const result = pathContinuation(BOZ_UY, 0, signals({ read: ['boz-uy-overview', 'boz-uy-karkas'], gotIt: ['tunduk'] }));
    expect(result).toMatchObject({ kind: 'next', index: 3, step: { type: 'interactive_lab', targetId: 'boz-uy' } });
  });

  it('same rule as the path screen Continue: the first incomplete step in order', () => {
    const state = signals({ read: ['boz-uy-karkas'] });
    const result = pathContinuation(BOZ_UY, 1, state);
    expect(result).toMatchObject({ kind: 'next', index: 0 });
    expect(pathProgress(BOZ_UY, state).nextIndex).toBe(0);
  });

  it('an activity without reliable evidence asks for manual confirmation first', () => {
    const before = signals({ read: ['boz-uy-overview', 'boz-uy-karkas'], gotIt: ['tunduk'] });
    expect(pathContinuation(BOZ_UY, 3, before)).toMatchObject({ kind: 'confirm', step: { id: 'build' } });
    const after = signals({ read: ['boz-uy-overview', 'boz-uy-karkas'], gotIt: ['tunduk'], manual: ['boz-uy/build'] });
    expect(pathContinuation(BOZ_UY, 3, after)).toMatchObject({ kind: 'next', step: { id: 'challenge' } });
  });

  it('practice alone does not complete an official-game step; an official round does', () => {
    let clock = Date.UTC(2026, 9, 5);
    const round = (practice: boolean) => makeSession('kok_boru', { practice, result: 'loss', primary: 1, secondary: {} }, new Date((clock += 60_000)));
    let records = [round(true), round(true), round(true)].reduce((acc, session) => recordInto(acc, session).records, EMPTY_RECORDS);
    const withRecords = () => signals({ read: ['horse-kok-boru'], games: (id) => officialRounds(records, id) > 0 });
    expect(pathContinuation(HORSE, 1, withRecords())).toEqual({ kind: 'pending' });
    records = recordInto(records, round(false)).records;
    expect(pathContinuation(HORSE, 1, withRecords())).toMatchObject({ kind: 'next', step: { id: 'read-kyz-kuumai' } });
  });

  it('all steps done: completion state suggests a started path first, else one not done', () => {
    const all = { read: ['boz-uy-overview', 'boz-uy-karkas'], gotIt: ['tunduk'], manual: ['boz-uy/build'], challenges: ['collection-boz-uy-world'] };
    expect(pathContinuation(BOZ_UY, 4, signals(all))).toEqual({ kind: 'done', otherPath: LEARNING_PATHS.find((candidate) => candidate.id === 'felt-oymo') });
    expect(pathContinuation(BOZ_UY, 4, signals({ ...all, read: [...all.read, 'horse-kok-boru'] }))).toEqual({ kind: 'done', otherPath: HORSE });
  });

  it('nothing else to suggest when every path is done', () => {
    const onlyPath: LearningPath = { id: 'solo', titleKey: 't', descriptionKey: 'd', heroItemId: null, steps: [{ id: 'a', type: 'culture_item', targetId: 'x' }] };
    expect(pathContinuation(onlyPath, 0, signals({ read: ['x'] }), [onlyPath])).toEqual({ kind: 'done', otherPath: null });
  });

  it('a next step whose target no longer exists is still offered as next (the card shows a recoverable state)', () => {
    const broken: LearningPath = { id: 'broken', titleKey: 't', descriptionKey: 'd', heroItemId: null, steps: [{ id: 'a', type: 'culture_item', targetId: 'x' }, { id: 'b', type: 'game', targetId: 'retired_game' }] };
    expect(pathContinuation(broken, 0, signals({ read: ['x'] }), [broken])).toMatchObject({ kind: 'next', step: { targetId: 'retired_game' } });
    expect(gameRouteFor('retired_game')).toBeNull();
  });
});

describe('wiring', () => {
  const read = (file: string) => fs.readFileSync(path.join(__dirname, '../../..', file), 'utf8');

  it('game results keep Replay / Exit and add the path card', () => {
    const source = read('src/games3d/ui/ResultScreen.tsx');
    expect(source).toContain('<PathContinueCard inline />');
    expect(source).toContain('onPress={onReplay}');
    expect(source).toContain('onPress={onExit}');
  });

  it('the path screen and the card build step links the same way', () => {
    expect(read('src/features/learn/LearningPathScreen.tsx')).toContain('stepHref(route, pathId)');
  });
});
