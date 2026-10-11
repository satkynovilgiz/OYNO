/** "Inside a boz uy" journey: real destinations, visited vs finished vs skipped, restart, missing content, owners, write failures. */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CULTURE_CONNECTIONS } from '@/features/culture/connections/connectionsData';
import { JOURNEYS_KEY, ownerJourney, useJourneyStore } from '@/store/useJourneyStore';
import { ownerManualSteps, useLearningPathStore } from '@/store/useLearningPathStore';

import { isManualStep, LEARNING_PATHS, pathProgress, stepRoute, validatePaths, type JourneySignals, type PathSignals } from './learningPaths';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const JOURNEY = LEARNING_PATHS.find((path) => path.id === 'inside-boz-uy')!;
const none: PathSignals = { readingCompleted: () => false, readingStarted: () => false, glossaryGotIt: () => false, glossarySeen: () => false, challengeCompleted: () => false, challengeStarted: () => false, gamePlayed: () => false, labFlag: () => false, manualCompleted: () => false };
const journey = (visited: string[] = [], skipped: string[] = []): JourneySignals => ({ visited: (id) => visited.includes(id), skipped: (id) => skipped.includes(id) });

describe('the journey definition', () => {
  it('opens the existing features', () => {
    expect(JOURNEY.steps.map((step) => [step.id, stepRoute(step, () => null)])).toEqual([
      ['discover', '/culture/item/boz-uy-overview'],
      ['build-from-memory', '/culture/boz-uy/memory'],
      ['connection', '/culture/connections/tunduk-part-of-karkas'],
      ['oymo-design', '/culture/oymo/create'],
      ['reflection', '/journal/new'],
    ]);
    // The connection is a real dataset entry; only the reflection is optional.
    expect(CULTURE_CONNECTIONS.some((connection) => connection.id === 'tunduk-part-of-karkas')).toBe(true);
    expect(JOURNEY.steps.filter((step) => step.optional).map((step) => step.id)).toEqual(['reflection']);
  });

  it('completion: real signals where they exist, otherwise the explicit "Mark step complete"', () => {
    expect(JOURNEY.steps.filter(isManualStep).map((step) => step.id)).toEqual(['build-from-memory', 'connection', 'reflection']);
    const signals = { ...none, readingCompleted: (id: string) => id === 'boz-uy-overview', labFlag: () => true };
    expect(pathProgress(JOURNEY, signals).states).toEqual(['completed', 'not_started', 'not_started', 'completed', 'not_started']);
  });

  it('a missing connection is reported by validation', () => {
    const broken = { ...JOURNEY, steps: JOURNEY.steps.map((step) => (step.type === 'connection' ? { ...step, targetId: 'not-in-dataset' } : step)) };
    const problems = validatePaths([broken], { cultureItems: new Set(['boz-uy-overview']), glossary: new Set(), challenges: new Set(), games: new Map(), hasKey: () => true, connections: new Set(CULTURE_CONNECTIONS.map((connection) => connection.id)) });
    expect(problems).toContain('inside-boz-uy: connection:not-in-dataset missing');
  });
});

describe('visited, finished, skipped', () => {
  it('opening a step only marks it visited (in progress), never finished', () => {
    const progress = pathProgress(JOURNEY, none, journey(['build-from-memory', 'connection']));
    expect(progress.states.slice(1, 3)).toEqual(['in_progress', 'in_progress']);
    expect(progress.completed).toBe(0);
    expect(progress.nextIndex).toBe(0);
  });

  it('skipping the optional reflection lets the journey finish; a required step cannot be skipped', () => {
    const allButReflection = { ...none, readingCompleted: () => true, labFlag: () => true, manualCompleted: (_: string, step: string) => step === 'build-from-memory' || step === 'connection' };
    expect(pathProgress(JOURNEY, allButReflection).done).toBe(false);
    expect(pathProgress(JOURNEY, allButReflection, journey([], ['reflection']))).toMatchObject({ done: true, nextIndex: null, completed: 4 });
    // "Skipping" a required step has no effect.
    expect(pathProgress(JOURNEY, none, journey([], ['connection'])).states[2]).toBe('not_started');
    // Revisit: a skipped step finished later counts as finished.
    expect(pathProgress(JOURNEY, { ...allButReflection, manualCompleted: () => true }, journey([], ['reflection'])).states[4]).toBe('completed');
  });
});

describe('storage: owners, restart, failures', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useJourneyStore.setState({ status: 'ready', saved: {} });
    useLearningPathStore.setState({ isLoaded: true, saved: {} });
  });

  it('per owner; restart clears this journey only; survives a reload', async () => {
    await useJourneyStore.getState().visit('user-a', 'inside-boz-uy', 'connection');
    await useJourneyStore.getState().setSkipped('user-a', 'inside-boz-uy', 'reflection', true);
    await useLearningPathStore.getState().setManual('user-a', 'inside-boz-uy', 'connection', true);
    await useLearningPathStore.getState().setManual('user-a', 'boz-uy', 'build', true);
    expect(ownerJourney(useJourneyStore.getState().saved, 'user-b', 'inside-boz-uy')).toEqual({ visited: {}, skipped: {} });
    expect(ownerManualSteps(useLearningPathStore.getState().saved, 'user-b')).toEqual({});
    useJourneyStore.setState({ status: 'idle', saved: {} });
    await useJourneyStore.getState().load();
    expect(Object.keys(ownerJourney(useJourneyStore.getState().saved, 'user-a', 'inside-boz-uy').skipped)).toEqual(['reflection']);
    expect(await useJourneyStore.getState().clearPath('user-a', 'inside-boz-uy')).toBe(true);
    expect(await useLearningPathStore.getState().clearPath('user-a', 'inside-boz-uy')).toBe(true);
    expect(ownerJourney(useJourneyStore.getState().saved, 'user-a', 'inside-boz-uy')).toEqual({ visited: {}, skipped: {} });
    expect(ownerManualSteps(useLearningPathStore.getState().saved, 'user-a')).toEqual({ 'boz-uy': { build: expect.any(String) } });
  });

  it('a failed write reports false and changes nothing; unreadable data blocks writes', async () => {
    const real = AsyncStorage.setItem;
    AsyncStorage.setItem = () => Promise.reject(new Error('disk full'));
    try {
      expect(await useLearningPathStore.getState().setManual('user-a', 'inside-boz-uy', 'connection', true)).toBe(false);
      expect(await useJourneyStore.getState().setSkipped('user-a', 'inside-boz-uy', 'reflection', true)).toBe(false);
    } finally {
      AsyncStorage.setItem = real;
    }
    expect(ownerManualSteps(useLearningPathStore.getState().saved, 'user-a')).toEqual({});
    expect(ownerJourney(useJourneyStore.getState().saved, 'user-a', 'inside-boz-uy').skipped).toEqual({});
    await AsyncStorage.setItem(JOURNEYS_KEY, 'nope');
    useJourneyStore.setState({ status: 'idle', saved: {} });
    await useJourneyStore.getState().load();
    expect(useJourneyStore.getState().status).toBe('error');
    expect(await useJourneyStore.getState().visit('user-a', 'inside-boz-uy', 'discover')).toBe(false);
    expect(await AsyncStorage.getItem(JOURNEYS_KEY)).toBe('nope');
  });
});
