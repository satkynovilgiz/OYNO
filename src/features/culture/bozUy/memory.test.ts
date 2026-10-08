import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { BOZ_UY_STEPS } from '@/services/culture/bozUySteps';

import { BuildFromMemoryScreen } from './BuildFromMemoryScreen';
import { choicesFor, isComplete, keepAttempt, memoryReducer, ORDER, resumeAttempt, review, startAttempt, summary, type MemoryAttempt } from './memoryModel';

jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/services/ageExperience/useAgeExperience', () => ({ useAgeExperience: () => ({ experience: 'adult' }) }));
jest.mock('@/services/a11y/announce', () => ({ announce: () => undefined }));
// The challenge must never award anything: any touch of the progress store fails loudly.
jest.mock('@/store/useProgressStore', () => ({ useProgressStore: { getState: () => { throw new Error('Build from Memory must not touch progress/XP'); } } }));
jest.mock('@/components/ui', () => {
  const { createElement: h } = jest.requireActual('react');
  return {
    AnimatedPressable: (props: Record<string, unknown>) => h('AnimatedPressable', props, props.children),
    Button: (props: Record<string, unknown>) => h('Button', props, props.label),
    IconButton: (props: Record<string, unknown>) => h('IconButton', props),
  };
});

const fixed = () => 0.42;
const run = (attempt: MemoryAttempt, ...actions: Parameters<typeof memoryReducer>[1][]) => actions.reduce(memoryReducer, attempt);

describe('the authored order', () => {
  it('is the guided builder\'s order; choices are the parts left, never offered already in order', () => {
    expect(ORDER).toEqual(BOZ_UY_STEPS.map((step) => step.id));
    for (let seed = 0; seed < 50; seed += 1) {
      const attempt = startAttempt('practice', () => (seed * 0.137) % 1);
      expect([...attempt.order].sort()).toEqual([...ORDER].sort());
      expect(attempt.order).not.toEqual(ORDER);
    }
  });

  it('correct order completes the reconstruction with no hints and every step first time', () => {
    const attempt = run(startAttempt('challenge', fixed), ...ORDER.map((part) => ({ type: 'choose' as const, part })));
    expect(isComplete(attempt)).toBe(true);
    expect(attempt.placed).toEqual(ORDER);
    expect(summary(attempt)).toEqual({ firstTry: 4, hints: 0, total: 4 });
    expect(choicesFor(attempt)).toEqual([]);
  });
});

describe('incorrect choices and hints', () => {
  it('a wrong pick is explained (lastWrong), recorded once, and places nothing; placed parts can\'t be picked again', () => {
    let attempt = run(startAttempt('practice', fixed), { type: 'choose', part: 'tunduk' });
    expect(attempt).toMatchObject({ placed: [], lastWrong: 'tunduk', wrong: { 0: ['tunduk'] } });
    attempt = run(attempt, { type: 'choose', part: 'tunduk' }, { type: 'choose', part: 'kerege' });
    expect(attempt).toMatchObject({ placed: ['kerege'], lastWrong: null, wrong: { 0: ['tunduk'] } });
    expect(run(attempt, { type: 'choose', part: 'kerege' }).placed).toEqual(['kerege']);
    // Every part has an authored tip to explain it with, in all three languages.
    for (const lang of [en, ru, kg]) for (const step of BOZ_UY_STEPS) expect((lang as unknown as { culture: { bozUy: { steps: Record<string, { tip: string }> } } }).culture.bozUy.steps[step.id].tip).toBeTruthy();
  });

  it('hints are optional, counted once per step, and shown in the review', () => {
    let attempt = run(startAttempt('challenge', fixed), { type: 'hint' }, { type: 'hint' }, { type: 'choose', part: 'kerege' }, { type: 'choose', part: 'bosogo' }, { type: 'choose', part: 'uuk' }, { type: 'hint' });
    attempt = run(attempt, { type: 'choose', part: 'tunduk' }, { type: 'choose', part: 'bosogo' });
    expect(review(attempt).map((row) => [row.part, row.hinted, row.wrongTries])).toEqual([
      ['kerege', true, []],
      ['uuk', false, ['bosogo']],
      ['tunduk', true, []],
      ['bosogo', false, []],
    ]);
    expect(summary(attempt)).toEqual({ firstTry: 1, hints: 2, total: 4 });
    expect(run(attempt, { type: 'hint' })).toBe(attempt); // nothing left to hint
  });

  it('restart begins a fresh attempt in the same mode', () => {
    const attempt = run(startAttempt('challenge', fixed), { type: 'choose', part: 'kerege' }, { type: 'hint' }, { type: 'restart', rng: fixed });
    expect(attempt).toMatchObject({ mode: 'challenge', placed: [], hinted: [], wrong: {} });
  });
});

describe('the screen', () => {
  let screen: ReactTestRenderer;
  const render = () =>
    act(() => {
      screen = create(createElement(BuildFromMemoryScreen, { onPressBack: () => undefined }));
    });
  const press = (testID: string) => act(() => screen.root.findAll((node) => node.props.testID === testID && node.props.onPress)[0].props.onPress());
  const has = (testID: string) => screen.root.findAll((node) => node.props.testID === testID).length > 0;
  beforeEach(() => keepAttempt(null));
  afterEach(() => act(() => screen.unmount()));

  it('a whole challenge: wrong pick explained, a hint, completion review - and nothing awarded', () => {
    render();
    expect(has('memory-intro')).toBe(true);
    press('memory-mode-challenge');
    press('memory-start');
    press('memory-choice-uuk');
    expect(has('memory-wrong')).toBe(true);
    press('memory-hint-button');
    expect(has('memory-hint')).toBe(true);
    for (const part of ORDER) press(`memory-choice-${part}`);
    expect(has('memory-done')).toBe(true);
    expect(has('memory-review-3')).toBe(true);
  });

  it('an interrupted attempt (screen re-created, e.g. after opening the article) resumes where it was', () => {
    render();
    press('memory-start');
    press('memory-choice-kerege');
    press('memory-choice-uuk');
    expect(resumeAttempt()?.placed).toEqual(['kerege', 'uuk']);
    act(() => screen.unmount());
    render();
    expect(has('memory-play')).toBe(true);
    expect(has('memory-placed-1')).toBe(true);
    press('memory-restart');
    expect(resumeAttempt()?.placed).toEqual([]);
  });
});
