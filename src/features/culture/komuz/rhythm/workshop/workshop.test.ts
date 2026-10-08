import { createElement } from 'react';
import { AppState } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';

import { LEAD_IN_MS } from '../repeat/repeatAudio';
import { beatMs, DOUBLE_TAP_MS } from '../repeat/repeatModel';
import { ABANDON_MS, attemptTimeoutMs, EMPTY_COMPOSITION, EXAMPLES, TEMPOS, MAX_NOTES, onsetsOf, playbackTimes, START_WORKSHOP, STEPS, toggleStep, validateComposition, visibleSteps, workshopReducer, type Composition, type WorkshopState } from './workshopModel';

jest.mock('@/services/supabase/client', () => ({ supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }) } } }));
const mockAudio = { plays: 0, disposed: 0 };
jest.mock('@/games3d/audio/GameAudioManager', () => ({
  GameAudioManager: class {
    play() {
      mockAudio.plays += 1;
    }
    dispose() {
      mockAudio.disposed += 1;
    }
  },
}));
jest.mock('../../listening/useKomuzPlayerStore', () => ({ useKomuzPlayerStore: { getState: () => ({ pause: () => undefined }) } }));
jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/components/ui', () => {
  const { createElement: h } = jest.requireActual('react');
  return {
    AnimatedPressable: (props: Record<string, unknown>) => h('AnimatedPressable', props, props.children),
    Button: (props: Record<string, unknown>) => h('Button', props, props.label),
    IconButton: (props: Record<string, unknown>) => h('IconButton', props),
  };
});
const mockFocus: { cleanups: (() => void)[] } = { cleanups: [] };
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { push: jest.fn() },
    useFocusEffect: (effect: () => (() => void) | void) =>
      useEffect(() => {
        const cleanup = effect();
        if (cleanup) mockFocus.cleanups.push(cleanup);
        return cleanup;
      }, [effect]),
  };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/services/ageExperience/useAgeExperience', () => ({ useAgeExperience: () => ({ experience: 'adult' }) }));
jest.mock('@/services/motion/useReducedMotion', () => ({ useReducedMotion: () => false }));
jest.mock('@/services/a11y/announce', () => ({ announce: () => undefined }));

const run = (state: WorkshopState, ...actions: Parameters<typeof workshopReducer>[1][]) => actions.reduce(workshopReducer, state);
const composed = (steps: number[], tempo: Composition['tempo'] = 85): WorkshopState => ({ ...START_WORKSHOP, composition: { steps, tempo } });
/** Taps for the locked rhythm at `bpm`, starting at `start`, each nudged by jitter (beats). */
const perform = (steps: number[], bpm: number, jitter: number[] = [], start = 5000) => onsetsOf({ steps, tempo: 85 }).map((beat, index) => start + (beat + (jitter[index] ?? 0)) * beatMs(bpm));
const toFeedback = (state: WorkshopState, taps: number[]) => run(run(state, { type: 'handOver' }, { type: 'playerReady' }, { type: 'demoDone' }), ...taps.map((at) => ({ type: 'tap' as const, at })));

describe('composition limits', () => {
  it('a bounded grid: 16 half-beat steps, at most 12 notes, nothing outside it', () => {
    let composition: Composition = EMPTY_COMPOSITION;
    for (let step = 0; step < STEPS; step += 1) composition = toggleStep(composition, step);
    expect(composition.steps).toHaveLength(MAX_NOTES);
    expect(toggleStep(composition, 15)).toBe(composition);
    expect(toggleStep(EMPTY_COMPOSITION, 16)).toBe(EMPTY_COMPOSITION);
    expect(toggleStep(EMPTY_COMPOSITION, -1)).toBe(EMPTY_COMPOSITION);
    expect(toggleStep(EMPTY_COMPOSITION, 1.5)).toBe(EMPTY_COMPOSITION);
    expect(toggleStep(toggleStep(EMPTY_COMPOSITION, 3), 3).steps).toEqual([]);
  });

  it('empty and one-note rhythms are rejected, tampered ones too; the examples are valid', () => {
    expect(validateComposition(EMPTY_COMPOSITION)).toBe('empty');
    expect(validateComposition({ steps: [4], tempo: 85 })).toBe('tooFew');
    expect(validateComposition({ steps: Array.from({ length: 13 }, (_, index) => index), tempo: 85 })).toBe('tooMany');
    expect(validateComposition({ steps: [0, 16], tempo: 85 })).toBe('outOfRange');
    expect(validateComposition({ steps: [0, 0, 2], tempo: 85 })).toBe('outOfRange');
    expect(validateComposition({ steps: [0, 2], tempo: 120 as never })).toBe('outOfRange');
    for (const example of EXAMPLES) expect(validateComposition({ steps: example.steps, tempo: 85 })).toBeNull();
    // Only a valid rhythm can be handed over.
    expect(run(composed([4]), { type: 'handOver' }).phase).toBe('compose');
  });

  it('timing: the first note starts the rhythm; half-beat units; total under 8 beats', () => {
    expect(onsetsOf({ steps: [2, 3, 6], tempo: 85 })).toEqual([0, 0.5, 2]);
    expect(playbackTimes({ steps: [0, 2], tempo: 100 })).toEqual([0, 600]);
    expect(Math.max(...onsetsOf({ steps: [0, 15], tempo: 85 }))).toBe(7.5);
  });
});

describe('handoff privacy', () => {
  it('the rhythm is hidden from the handoff on, until the player asks to see it after trying', () => {
    let state = run(composed([0, 2, 5]), { type: 'handOver' });
    expect(state.phase).toBe('handoff');
    expect(visibleSteps(state)).toBeNull();
    state = run(state, { type: 'playerReady' });
    expect(visibleSteps(state)).toBeNull();
    state = run(state, { type: 'demoDone' });
    expect(visibleSteps(state)).toBeNull();
    // The answer can't be edited or revealed early.
    expect(run(state, { type: 'toggle', step: 9 }).locked?.steps).toEqual([0, 2, 5]);
    expect(run(state, { type: 'reveal' }).revealed).toBe(false);
    state = toFeedback(composed([0, 2, 5]), perform([0, 2, 5], 85));
    expect(state.phase).toBe('feedback');
    expect(visibleSteps(state)).toBeNull();
    expect(visibleSteps(run(state, { type: 'reveal' }))).toEqual([0, 2, 5]);
    // Trying again hides it again; going back to the composer unlocks it.
    expect(visibleSteps(run(state, { type: 'reveal' }, { type: 'tryAgain' }))).toBeNull();
    expect(run(state, { type: 'backToCompose' })).toMatchObject({ phase: 'compose', locked: null, result: null });
  });
});

describe('scoring (Repeat the Rhythm relative timing)', () => {
  it('a faithful performance scores in full at any tempo; the same jitter scores the same slow or fast', () => {
    const steps = EXAMPLES[2].steps;
    const full = toFeedback(composed(steps), perform(steps, 85)).result!;
    expect(full.points).toBe(full.maxPoints);
    const jitter = [0, 0.05, -0.2, 0.1, 0.3, 0];
    const slow = toFeedback(composed(steps, 70), perform(steps, 70, jitter)).result!;
    const fast = toFeedback(composed(steps, 70), perform(steps, 100, jitter)).result!;
    expect(fast.points).toBe(slow.points);
    expect(fast.beats.map((beat) => beat.grade)).toEqual(slow.beats.map((beat) => beat.grade));
    expect(fast.tempo).toBe('faster');
  });

  it('double taps never add notes; taps after the end change nothing; an interruption drops the attempt', () => {
    const steps = [0, 2, 4, 6];
    const bouncy = perform(steps, 85).flatMap((at) => [at, at + DOUBLE_TAP_MS / 2]);
    const result = toFeedback(composed(steps), bouncy);
    expect(result.result!.points).toBe(result.result!.maxPoints);
    expect(result.result!.ignoredTaps).toBeGreaterThan(0);
    expect(run(result, { type: 'tap', at: 1e9 })).toBe(result);
    const mid = run(composed(steps), { type: 'handOver' }, { type: 'playerReady' }, { type: 'demoDone' }, { type: 'tap', at: 100 });
    expect(run(mid, { type: 'interrupt' })).toMatchObject({ phase: 'handoff', taps: [] });
  });
});

describe('the real screen: playback is cancelled; the handoff shows no answer', () => {
  let screen: ReactTestRenderer;
  const find = (testID: string): ReactTestInstance | undefined => screen.root.findAll((node) => node.props.testID === testID && typeof node.props.onPress === 'function')[0];
  const press = (testID: string) => act(() => find(testID)!.props.onPress());

  const appStateListeners: ((state: string) => void)[] = [];
  beforeEach(() => {
    appStateListeners.length = 0;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_event: string, listener: (state: string) => void) => {
      appStateListeners.push(listener);
      return { remove: () => undefined };
    }) as never);
    jest.useFakeTimers();
    mockAudio.plays = 0;
    mockAudio.disposed = 0;
    mockFocus.cleanups = [];
    const { RhythmWorkshopScreen } = jest.requireActual('./RhythmWorkshopScreen');
    act(() => {
      screen = create(createElement(RhythmWorkshopScreen, { onPressBack: () => undefined }));
    });
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('Stop, leaving the screen, backgrounding and unmounting all silence the rhythm at once', () => {
    press('ws-example-walk');
    press('ws-play');
    act(() => jest.advanceTimersByTime(LEAD_IN_MS + 10));
    const first = mockAudio.plays;
    expect(first).toBeGreaterThan(0);
    press('ws-stop');
    act(() => jest.advanceTimersByTime(20000));
    expect(mockAudio.plays).toBe(first);

    press('ws-play');
    act(() => jest.advanceTimersByTime(LEAD_IN_MS + 10));
    const second = mockAudio.plays;
    act(() => mockFocus.cleanups.forEach((cleanup) => cleanup()));
    act(() => jest.advanceTimersByTime(20000));
    expect(mockAudio.plays).toBe(second);

    press('ws-play');
    act(() => jest.advanceTimersByTime(LEAD_IN_MS + 10));
    const third = mockAudio.plays;
    expect(appStateListeners.length).toBeGreaterThan(0);
    act(() => appStateListeners.forEach((listener) => listener('background')));
    act(() => jest.advanceTimersByTime(20000));
    expect(mockAudio.plays).toBe(third);

    press('ws-play');
    act(() => jest.advanceTimersByTime(LEAD_IN_MS + 10));
    const fourth = mockAudio.plays;
    act(() => screen.unmount());
    act(() => jest.advanceTimersByTime(20000));
    expect(mockAudio.plays).toBe(fourth);
    expect(mockAudio.disposed).toBe(1);
  });

  const status = () => String(screen.root.findAll((node) => node.props.testID === 'ws-status')[0]?.props.children ?? '');
  const has = (testID: string) => screen.root.findAll((node) => node.props.testID === testID).length > 0;
  const tap = () => act(() => screen.root.findAll((node) => node.props.testID === 'ws-pad' && typeof node.props.onPressIn === 'function')[0].props.onPressIn());
  /** Compose [0, 15] at 70 BPM, hand over and sit through the demonstration. */
  function longRest() {
    press('ws-step-0');
    press('ws-step-15');
    press('ws-tempo-70');
    press('ws-hand-over');
    press('ws-player-ready');
    act(() => jest.advanceTimersByTime(LEAD_IN_MS + 6430 + 600));
    expect(status()).toBe('rhythmWorkshop.yourTurn');
  }

  it('a 6.43 s rest (steps 0 and 15 at 70 BPM) does not end the attempt early; the second tap completes it', () => {
    longRest();
    tap();
    act(() => jest.advanceTimersByTime(6000)); // the old timer gave up after ~2.1 s
    expect(has('ws-feedback')).toBe(false);
    expect(status()).toBe('rhythmWorkshop.tapped');
    act(() => jest.advanceTimersByTime(430));
    tap();
    expect(has('ws-feedback')).toBe(true);
    act(() => screen.unmount());
  });

  it('played slower than the demonstration it still waits; an abandoned attempt ends within the bound; Done ends it at once', () => {
    longRest();
    tap();
    act(() => jest.advanceTimersByTime(9500)); // ~1.5x slower than the rest
    expect(has('ws-feedback')).toBe(false);
    act(() => jest.advanceTimersByTime(ABANDON_MS));
    expect(has('ws-feedback')).toBe(true);
    press('ws-try-again');
    press('ws-player-ready');
    act(() => jest.advanceTimersByTime(LEAD_IN_MS + 6430 + 600));
    tap();
    press('ws-done');
    expect(has('ws-feedback')).toBe(true);
    act(() => screen.unmount());
  });

  it('replay, backgrounding and leaving cancel the pending timeout', () => {
    longRest();
    tap();
    press('ws-replay');
    act(() => jest.advanceTimersByTime(LEAD_IN_MS + 6430 + 600));
    expect(status()).toBe('rhythmWorkshop.yourTurn'); // back to ready, not ended by the old timer
    act(() => jest.advanceTimersByTime(ABANDON_MS * 2));
    expect(has('ws-feedback')).toBe(false);
    tap();
    act(() => appStateListeners.forEach((listener) => listener('background')));
    act(() => jest.advanceTimersByTime(ABANDON_MS * 2));
    expect(has('ws-handoff')).toBe(true);
    expect(has('ws-feedback')).toBe(false);
    press('ws-player-ready');
    act(() => jest.advanceTimersByTime(LEAD_IN_MS + 6430 + 600));
    tap();
    act(() => screen.unmount());
    expect(() => act(() => jest.advanceTimersByTime(ABANDON_MS * 2))).not.toThrow();
  });

  it('after handing over, nothing on screen reveals the rhythm (no grid) until it is revealed', () => {
    press('ws-example-hop');
    press('ws-hand-over');
    expect(screen.root.findAll((node) => node.props.testID === 'ws-handoff').length).toBeGreaterThan(0);
    expect(screen.root.findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('ws-step-'))).toHaveLength(0);
    expect(screen.root.findAll((node) => node.props.testID === 'ws-grid' || node.props.testID === 'ws-grid-revealed')).toHaveLength(0);
    press('ws-player-ready');
    act(() => jest.advanceTimersByTime(LEAD_IN_MS + 5));
    expect(screen.root.findAll((node) => node.props.testID === 'ws-grid' || node.props.testID === 'ws-grid-revealed')).toHaveLength(0);
    act(() => screen.unmount());
  });
});

describe('attempts wait for the rhythm itself', () => {
  it('every accepted gap, at every tempo, gets more time than the gap - even played up to 1.5x slower - and never more than the bound', () => {
    for (const tempo of TEMPOS) {
      for (let last = 1; last < STEPS; last += 1) {
        const locked: Composition = { steps: [0, last], tempo };
        const gapMs = last * 0.5 * beatMs(tempo);
        expect(attemptTimeoutMs(locked, [1000])).toBeGreaterThan(gapMs * 1.5);
        expect(attemptTimeoutMs(locked, [1000])).toBeLessThanOrEqual(ABANDON_MS);
      }
    }
    // The review's example: steps [0, 15] at 70 BPM is a 6.43 s rest.
    expect(attemptTimeoutMs({ steps: [0, 15], tempo: 70 }, [0])).toBeGreaterThan(6430 * 1.5);
  });

  it("follows the player's own (slower) tempo for later gaps, capped", () => {
    const locked: Composition = { steps: [0, 2, 4, 14], tempo: 100 }; // 600 ms beats; then a 5-beat rest
    const demoPace = attemptTimeoutMs(locked, [0, 600, 1200]);
    const slowPace = attemptTimeoutMs(locked, [0, 1100, 2200]); // player at ~1100 ms a beat
    expect(slowPace).toBeGreaterThan(demoPace);
    // A very slow player: at most twice the demonstration's beat (5 beats x 1200 ms x 1.75 + 1.5 s), within the bound.
    expect(attemptTimeoutMs(locked, [0, 9000, 18000])).toBe(12000);
    expect(attemptTimeoutMs({ steps: [0, 15], tempo: 70 }, [0, 0])).toBeLessThanOrEqual(ABANDON_MS);
  });
});

describe('texts', () => {
  it('KG/RU/EN; the rhythm is called a practice exercise and the feedback timing similarity', () => {
    for (const lang of [en, ru, kg]) {
      const section = (lang as unknown as { rhythmWorkshop: Record<string, unknown> }).rhythmWorkshop as { practiceNote: string; feedbackNote: string; examples: Record<string, string>; problems: Record<string, string> };
      expect(section.practiceNote).toBeTruthy();
      expect(section.feedbackNote).toBeTruthy();
      for (const example of EXAMPLES) expect(section.examples[example.id]).toBeTruthy();
      for (const problem of ['empty', 'tooFew', 'tooMany', 'outOfRange']) expect(section.problems[problem]).toBeTruthy();
    }
    expect(en.rhythmWorkshop.practiceNote).toContain('not traditional komuz music');
    expect(en.rhythmWorkshop.feedbackNote).toContain("isn't a judgement of musical skill");
  });
});
