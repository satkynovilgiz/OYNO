import * as fs from 'fs';
import * as path from 'path';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { collections } from '@/features/collections/collectionsData';
import { collectionQuestionIds } from '@/features/challenges/challengeLogic';
import { GLOSSARY } from '@/features/culture/glossary/glossaryData';
import { seededCultureItems } from '@/features/culture/glossary/seededCultureItems';
import { GAME_RECORD_RULES } from '@/features/games/records/gameRecords';
import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { mergeManualSteps, ownerManualSteps, useLearningPathStore } from '@/store/useLearningPathStore';

import { LEARNING_PATHS, pathProgress, pickHomePath, stepState, validatePaths, type PathSignals } from './learningPaths';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const ROOT = path.join(__dirname, '../../..');
const lookup = (dict: unknown, key: string) => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict);
const NONE: PathSignals = {
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
const catalog = {
  cultureItems: new Set(seededCultureItems(ROOT).keys()),
  glossary: new Set(GLOSSARY.map((entry) => entry.id)),
  challenges: new Set(collections.filter((collection) => collectionQuestionIds(collection).length > 0).map((collection) => `collection-${collection.id}`)),
  games: new Map(Object.values(GAME_RECORD_RULES).map((rule) => [rule.gameId, rule.route])),
  hasKey: (key: string) => [en, ru, kg].every((dict) => typeof lookup(dict, key) === 'string' && (lookup(dict, key) as string).length > 0),
};

describe('Learning Paths - integrity', () => {
  it('every path resolves: unique ids, real targets, routes, >= 3 steps, strings in KG/RU/EN', () => {
    expect(LEARNING_PATHS.length).toBeLessThanOrEqual(3);
    expect(validatePaths(LEARNING_PATHS, catalog)).toEqual([]);
  });

  it('an invalid target fails the validator', () => {
    const broken = [{ ...LEARNING_PATHS[0], steps: [...LEARNING_PATHS[0].steps, { id: 'x', type: 'culture_item' as const, targetId: 'no-such-item' }] }];
    expect(validatePaths(broken, catalog)).toContain('boz-uy: culture_item:no-such-item missing');
    const short = [{ ...LEARNING_PATHS[0], id: 'tiny', steps: LEARNING_PATHS[0].steps.slice(0, 2) }];
    expect(validatePaths(short, catalog)).toContain('tiny: fewer than 3 steps');
  });
});

describe('Learning Paths - progress', () => {
  const boz = LEARNING_PATHS.find((entry) => entry.id === 'boz-uy')!;

  it('nothing done -> not started everywhere; Continue = the first step (no fake completion on open)', () => {
    const progress = pathProgress(boz, NONE);
    expect(progress).toMatchObject({ completed: 0, nextIndex: 0, done: false, started: false });
    const screen = fs.readFileSync(path.join(__dirname, 'LearningPathScreen.tsx'), 'utf8');
    // The only write is the explicit Mark-step-complete control.
    expect(screen.match(/setManual\(/g)).toHaveLength(1);
    expect(screen).not.toMatch(/useEffect\([^)]*setManual/);
  });

  it('mixed real signals: reading, glossary Got it, manual lab step, challenge', () => {
    const signals: PathSignals = {
      ...NONE,
      readingCompleted: (id) => id === 'boz-uy-overview',
      readingStarted: (id) => id === 'boz-uy-karkas',
      glossaryGotIt: (id) => id === 'tunduk',
      manualCompleted: (pathId, stepId) => pathId === 'boz-uy' && stepId === 'build',
    };
    const progress = pathProgress(boz, signals);
    expect(progress.states).toEqual(['completed', 'in_progress', 'completed', 'completed', 'not_started']);
    expect(progress.nextIndex).toBe(1);
    expect(progress.started).toBe(true);
  });

  it('labs with a real signal use it (no manual override needed)', () => {
    const felt = LEARNING_PATHS.find((entry) => entry.id === 'felt-oymo')!;
    const lab = felt.steps.find((step) => step.targetId === 'oymo')!;
    expect(stepState(felt, lab, { ...NONE, labFlag: (flag) => flag === 'oymoCreated' })).toBe('completed');
    expect(stepState(felt, lab, { ...NONE, manualCompleted: () => true })).toBe('not_started');
  });

  it('completed path; Home picks the active path, else the first not done', () => {
    const all: PathSignals = { readingCompleted: () => true, readingStarted: () => true, glossaryGotIt: () => true, glossarySeen: () => true, challengeCompleted: () => true, challengeStarted: () => true, gamePlayed: () => true, labFlag: () => true, manualCompleted: () => true };
    expect(pathProgress(boz, all)).toMatchObject({ done: true, nextIndex: null });
    expect(pickHomePath(LEARNING_PATHS, NONE)?.path.id).toBe('boz-uy');
    const horseStarted: PathSignals = { ...NONE, readingCompleted: (id) => id === 'horse-kok-boru' };
    expect(pickHomePath(LEARNING_PATHS, horseStarted)?.path.id).toBe('horse-games');
    expect(pickHomePath(LEARNING_PATHS, all)).toBeNull();
  });
});

describe('Learning Paths - manual steps per owner', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useLearningPathStore.setState({ isLoaded: false, saved: {} });
  });

  it('guest persists, adopted on sign-in, never visible to another account', async () => {
    await useLearningPathStore.getState().load();
    useLearningPathStore.getState().setManual('guest', 'boz-uy', 'build', true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    useLearningPathStore.setState({ isLoaded: false, saved: {} });
    await useLearningPathStore.getState().load();
    expect(ownerManualSteps(useLearningPathStore.getState().saved, 'guest')['boz-uy'].build).toBeTruthy();
    useLearningPathStore.getState().adoptGuest('user-a');
    const saved = useLearningPathStore.getState().saved;
    expect(ownerManualSteps(saved, 'user-a')['boz-uy'].build).toBeTruthy();
    expect(ownerManualSteps(saved, 'user-b')).toEqual({});
    expect(mergeManualSteps({ p: { s: '2026-10-02' } }, { p: { s: '2026-10-01' } }).p.s).toBe('2026-10-01');
  });

  it('KG / RU / EN UI keys', () => {
    for (const key of ['learningPaths.title', 'learningPaths.continue', 'learningPaths.start', 'learningPaths.completed', 'learningPaths.backToPath', 'learningPaths.progress', 'learningPaths.state.in_progress']) {
      for (const dict of [en, ru, kg]) expect(lookup(dict, key)).toBeTruthy();
    }
  });
});
