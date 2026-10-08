import AsyncStorage from '@react-native-async-storage/async-storage';
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { GAME_RECORDS_KEY } from '@/store/useGameRecordsStore';
import { ownerRepeat, RHYTHM_REPEAT_KEY, useRhythmRepeatStore } from '@/store/useRhythmRepeatStore';

import { LEAD_IN_MS, playExample, TAIL_MS, type Timers } from './repeatAudio';
import { beatMs, buildRounds, CLOSE_BEATS, DIFFICULTIES, DOUBLE_TAP_MS, exampleTimes, LEVELS, ON_TIME_BEATS, PATTERN_IDS, PATTERNS, ROUNDS, scoreTaps, sessionReducer, startSession, summarize, type PatternId, type SessionState } from './repeatModel';

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
const mockKomuz = { pauses: 0 };
jest.mock('../../listening/useKomuzPlayerStore', () => ({ useKomuzPlayerStore: { getState: () => ({ pause: () => (mockKomuz.pauses += 1) }) } }));
jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/components/ui', () => {
  const { createElement: h } = jest.requireActual('react');
  return {
    AnimatedPressable: (props: Record<string, unknown>) => h('AnimatedPressable', props, props.children),
    Button: (props: Record<string, unknown>) => h('Button', props, props.label),
    IconButton: (props: Record<string, unknown>) => h('IconButton', props),
    Toggle: (props: Record<string, unknown>) => h('Toggle', props),
  };
});
const mockFocus: { cleanups: (() => void)[] } = { cleanups: [] };
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { push: jest.fn() },
    // Runs like a focus effect; the cleanup is kept so a test can "blur" the screen.
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
jest.mock('@/features/games/records/useGameRecords', () => ({ useRecordsOwner: () => 'guest' }));

/** Taps for `pattern` at `bpm`, starting at `start` ms, each nudged by `jitter[i]` beats. */
const perform = (pattern: PatternId, bpm: number, jitter: number[] = [], start = 1234) => PATTERNS[pattern].map((beat, index) => start + (beat + (jitter[index] ?? 0)) * beatMs(bpm));

describe('relative timing', () => {
  it('slow and fast versions of the same performance score identically', () => {
    const jitter = [0, 0.05, -0.18, 0.02, 0.3, -0.04];
    for (const pattern of PATTERN_IDS) {
      const slow = scoreTaps(pattern, 70, perform(pattern, 70, jitter));
      const fast = scoreTaps(pattern, 70, perform(pattern, 100, jitter, 99));
      expect(fast.beats.map((beat) => beat.grade)).toEqual(slow.beats.map((beat) => beat.grade));
      expect(fast.points).toBe(slow.points);
      // ...and against either example tempo; only the tempo note differs.
      expect(scoreTaps(pattern, 100, perform(pattern, 100, jitter)).points).toBe(slow.points);
      expect(fast.tempo).toBe('faster');
      expect(slow.tempo).toBe('steady');
    }
  });

  it('a perfect performance at any tempo or start time gets full points', () => {
    for (const bpm of [50, 70, 85, 100, 130]) {
      const result = scoreTaps('skip', 85, perform('skip', bpm, [], bpm * 17));
      expect(result.points).toBe(result.maxPoints);
      expect(result.beats.every((beat) => beat.grade === 'onTime')).toBe(true);
    }
  });

  it('documented tolerances: on time within an eighth-ish of a beat, close within a quarter, otherwise off; early/late sign kept', () => {
    expect(ON_TIME_BEATS).toBe(0.12);
    expect(CLOSE_BEATS).toBe(0.25);
    const grade = (dev: number) => scoreTaps('even', 100, [0, 600, 1200 + dev * 600, 1800]).beats[2];
    expect(grade(0.05).grade).toBe('onTime');
    expect(grade(0.25).grade).toBe('close');
    expect(grade(0.6).grade).toBe('off');
    expect(grade(-0.25).deviation!).toBeLessThan(0);
    expect(grade(0.25).deviation!).toBeGreaterThan(0);
  });

  it('too few taps earn nothing (two taps always fit); missing notes are reported', () => {
    expect(scoreTaps('run', 85, [0, 350]).points).toBe(0);
    expect(scoreTaps('run', 85, [0, 350]).tempo).toBeNull();
    const partial = scoreTaps('run', 85, perform('run', 85).slice(0, 4));
    expect(partial.beats.slice(4).map((beat) => beat.grade)).toEqual(['missing', 'missing']);
    expect(partial.points).toBe(8);
  });
});

describe('round transitions', () => {
  const tapAll = (state: SessionState, times: number[]) => times.reduce((current, at) => sessionReducer(current, { type: 'tap', at }), state);
  const ready = (pattern: PatternId) => sessionReducer(startSession('medium', [pattern, 'pairs', 'run', 'offbeat', 'long-short']), { type: 'demoDone' });

  it('listen -> ready -> tapping -> feedback; the round ends when every note has a tap', () => {
    let state = startSession('medium', ['even', 'pairs', 'run', 'offbeat', 'long-short']);
    expect(state.phase).toBe('listen');
    expect(sessionReducer(state, { type: 'tap', at: 5 })).toBe(state); // taps during the example are ignored
    state = sessionReducer(state, { type: 'demoDone' });
    state = tapAll(state, perform('even', 85));
    expect(state.phase).toBe('feedback');
    expect(state.results[0].points).toBe(8);
  });

  it('double taps and a flood of taps can never inflate the score', () => {
    const clean = tapAll(ready('even'), perform('even', 85));
    const bouncy = tapAll(ready('even'), perform('even', 85).flatMap((at) => [at, at + DOUBLE_TAP_MS / 2, at + DOUBLE_TAP_MS - 1]));
    expect(bouncy.results[0].points).toBe(clean.results[0].points);
    expect(bouncy.results[0].ignoredTaps).toBeGreaterThan(0);
    // Tapping on after the round ended changes nothing.
    const after = tapAll(clean, [99999, 100500, 101000]);
    expect(after).toBe(clean);
    // Finishing twice, or "next" before feedback, changes nothing.
    expect(sessionReducer(clean, { type: 'finish' })).toBe(clean);
    expect(sessionReducer(ready('even'), { type: 'next' }).phase).toBe('ready');
    // A tap earlier than the last one (non-monotonic) is never trusted.
    const one = tapAll(ready('even'), [1000]);
    expect(sessionReducer(one, { type: 'tap', at: 500 })).toBe(one);
    expect(sessionReducer(one, { type: 'tap', at: Number.NaN })).toBe(one);
  });

  it('an interruption discards the attempt; the round restarts from the example and is scored once', () => {
    let state = tapAll(ready('pairs'), perform('pairs', 85).slice(0, 4));
    state = sessionReducer(state, { type: 'interrupt' });
    expect(state).toMatchObject({ phase: 'paused', taps: [], results: [] });
    expect(sessionReducer(state, { type: 'finish' })).toBe(state);
    expect(sessionReducer(state, { type: 'tap', at: 1e6 })).toBe(state);
    state = sessionReducer(state, { type: 'restart' });
    expect(state.phase).toBe('listen');
    state = tapAll(sessionReducer(state, { type: 'demoDone' }), perform('pairs', 85, [], 50000));
    expect(state.results).toHaveLength(1);
    // Interrupting the feedback screen keeps the result.
    expect(sessionReducer(state, { type: 'interrupt' })).toBe(state);
  });

  it('"hear it again" while tapping discards the half-done attempt', () => {
    const state = sessionReducer(tapAll(ready('run'), [0, 350]), { type: 'replay' });
    expect(state).toMatchObject({ phase: 'listen', taps: [] });
  });

  it('five rounds then a summary that adds up', () => {
    const rounds = buildRounds('hard', () => 0.3);
    let state = startSession('hard', rounds);
    for (let index = 0; index < ROUNDS; index += 1) {
      state = sessionReducer(state, { type: 'demoDone' });
      state = tapAll(state, perform(rounds[index], 100, index === 2 ? [0, 0.2] : [], index * 100000));
      expect(state.phase).toBe('feedback');
      state = sessionReducer(state, { type: 'next' });
    }
    expect(state.phase).toBe('summary');
    const summary = summarize(state);
    expect(summary.rounds).toBe(5);
    expect(summary.maxPoints).toBe(rounds.reduce((sum, id) => sum + PATTERNS[id].length * 2, 0));
    expect(summary.points).toBe(state.results.reduce((sum, round) => sum + round.points, 0));
    expect(summary.onTime + summary.close + summary.off + summary.missing).toBe(rounds.reduce((sum, id) => sum + PATTERNS[id].length, 0));
  });

  it('rounds use only the level patterns, each before any repeat, never twice in a row', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 1; seed < 60; seed += 1) {
        let value = seed;
        const rng = () => ((value = (value * 9301 + 49297) % 233280) / 233280);
        const rounds = buildRounds(difficulty, rng);
        expect(rounds).toHaveLength(ROUNDS);
        expect(new Set(rounds)).toEqual(new Set(LEVELS[difficulty].patterns));
        rounds.forEach((id, index) => index > 0 && expect(id).not.toBe(rounds[index - 1]));
      }
    }
  });
});

describe('the example', () => {
  function fakeTimers() {
    let now = 0;
    let queue: { at: number; callback: () => void; handle: number }[] = [];
    let next = 1;
    const timers: Timers = {
      set: (callback, ms) => {
        const handle = next++;
        queue.push({ at: now + ms, callback, handle });
        return handle;
      },
      clear: (handle) => {
        queue = queue.filter((item) => item.handle !== handle);
      },
    };
    const advance = (ms: number, lag = 0) => {
      const until = now + ms;
      for (;;) {
        queue.sort((a, b) => a.at - b.at);
        const item = queue[0];
        if (!item || item.at > until) break;
        queue.shift();
        now = item.at + lag; // a late timer...
        item.callback();
      }
      now = Math.max(now, until);
    };
    return { timers, clock: () => now, advance, pending: () => queue.length };
  }

  it('plays each note at its time from one monotonic start (late timers never accumulate drift)', () => {
    const fake = fakeTimers();
    const heard: number[] = [];
    let done = false;
    const times = exampleTimes('pairs', 85);
    playExample(times, { onNote: () => heard.push(fake.clock()), onDone: () => (done = true) }, fake.clock, fake.timers);
    // Every timer fires 15 ms late: each note is 15 ms late - the lateness never adds up.
    fake.advance(10000, 15);
    expect(heard).toEqual(times.map((time) => time + LEAD_IN_MS + 15));
    expect(done).toBe(true);
    expect(fake.pending()).toBe(0);
    expect(times[times.length - 1] + LEAD_IN_MS + TAIL_MS).toBeLessThan(10000);
  });

  it('cancel silences everything still pending', () => {
    const fake = fakeTimers();
    const heard: number[] = [];
    let done = false;
    const cancel = playExample(exampleTimes('run', 85), { onNote: (index) => heard.push(index), onDone: () => (done = true) }, fake.clock, fake.timers);
    fake.advance(LEAD_IN_MS + 400);
    cancel();
    fake.advance(10000);
    expect(heard).toEqual([0, 1]);
    expect(done).toBe(false);
    expect(fake.pending()).toBe(0);
  });
});

describe('screen: audio stops when leaving; results are this mode own', () => {
  let screen: ReactTestRenderer;
  const node = (testID: string): ReactTestInstance | undefined => screen.root.findAll((item) => item.props.testID === testID && (typeof item.props.onPress === 'function' || typeof item.props.onPressIn === 'function'))[0];
  const press = (testID: string) => act(() => node(testID)!.props.onPress());

  beforeEach(async () => {
    jest.useFakeTimers();
    await AsyncStorage.clear();
    useRhythmRepeatStore.setState({ saved: {}, isLoaded: true });
    mockAudio.plays = 0;
    mockAudio.disposed = 0;
    mockFocus.cleanups = [];
    const { RepeatRhythmScreen } = jest.requireActual('./RepeatRhythmScreen');
    act(() => {
      screen = create(createElement(RepeatRhythmScreen, { onPressBack: () => undefined }));
    });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('leaving mid-example: no further sound, the player is released', () => {
    press('repeat-start');
    act(() => jest.advanceTimersByTime(LEAD_IN_MS + 10));
    const heard = mockAudio.plays;
    expect(heard).toBeGreaterThan(0);
    expect(mockKomuz.pauses).toBeGreaterThan(0); // a playing komuz track never plays under the example
    act(() => screen.unmount());
    act(() => jest.advanceTimersByTime(20000));
    expect(mockAudio.plays).toBe(heard);
    expect(mockAudio.disposed).toBe(1);
  });

  it('leaving for another screen pauses the round and silences it; it restarts from the example', () => {
    press('repeat-start');
    act(() => jest.advanceTimersByTime(LEAD_IN_MS + 10));
    const heard = mockAudio.plays;
    act(() => mockFocus.cleanups.forEach((cleanup) => cleanup()));
    act(() => jest.advanceTimersByTime(20000));
    expect(mockAudio.plays).toBe(heard);
    expect(node('repeat-restart')).toBeDefined();
    press('repeat-restart');
    act(() => jest.advanceTimersByTime(LEAD_IN_MS + 10));
    expect(mockAudio.plays).toBeGreaterThan(heard);
    act(() => screen.unmount());
  });

  it('sound off: the example is lights only', () => {
    act(() => screen.root.findAll((item) => (item.type as unknown) === 'Toggle')[0].props.onValueChange(false));
    press('repeat-start');
    act(() => jest.advanceTimersByTime(3000));
    expect(mockAudio.plays).toBe(0);
    act(() => screen.unmount());
  });

  it('a full session is recorded once, per owner, never as game records', async () => {
    press('repeat-start');
    for (let round = 0; round < ROUNDS; round += 1) {
      act(() => jest.advanceTimersByTime(6000)); // the example, then "your turn"
      for (let tap = 0; tap < 6 && node('repeat-pad'); tap += 1) {
        act(() => node('repeat-pad')!.props.onPressIn());
        act(() => jest.advanceTimersByTime(600));
      }
      act(() => jest.advanceTimersByTime(4000)); // silence ends a short attempt
      press('repeat-next');
    }
    expect(node('repeat-again')).toBeDefined();
    expect(ownerRepeat(useRhythmRepeatStore.getState().saved, 'guest').easy?.sessions).toBe(1);
    expect(ownerRepeat(useRhythmRepeatStore.getState().saved, 'user-b')).toEqual({});
    jest.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await AsyncStorage.getItem(RHYTHM_REPEAT_KEY)).toContain('guest');
    expect(await AsyncStorage.getItem(GAME_RECORDS_KEY)).toBeNull();
    act(() => screen.unmount());
  });
});

describe('store and labels', () => {
  it('tampered saved data is cleaned', async () => {
    await AsyncStorage.setItem(RHYTHM_REPEAT_KEY, JSON.stringify({ guest: { easy: { bestPoints: 30, maxPoints: 40, sessions: 2 }, insane: { bestPoints: 1 }, hard: { bestPoints: -4, maxPoints: 'x', sessions: 1.5 } }, bad: 7 }));
    useRhythmRepeatStore.setState({ saved: {}, isLoaded: false });
    await useRhythmRepeatStore.getState().load();
    expect(useRhythmRepeatStore.getState().saved).toEqual({ guest: { easy: { bestPoints: 30, maxPoints: 40, sessions: 2 }, hard: { bestPoints: 0, maxPoints: 0, sessions: 0 } } });
  });

  it('six authored exercises, named in every language, labelled as practice exercises (not traditional rhythms)', () => {
    expect(PATTERN_IDS).toHaveLength(6);
    for (const id of PATTERN_IDS) {
      expect(PATTERNS[id][0]).toBe(0);
      PATTERNS[id].forEach((beat, index) => index > 0 && expect(beat - PATTERNS[id][index - 1]).toBeGreaterThanOrEqual(0.5));
    }
    for (const lang of [en, ru, kg]) {
      const section = (lang as unknown as { rhythmRepeat: { patterns: Record<string, string>; exercisesNote: string } }).rhythmRepeat;
      for (const id of PATTERN_IDS) expect(section.patterns[id]).toBeTruthy();
      expect(section.exercisesNote).toBeTruthy();
    }
    expect(en.rhythmRepeat.exercisesNote).toMatch(/not traditional komuz rhythms/);
    // The close window never reaches halfway to the nearest other note.
    expect(CLOSE_BEATS).toBeLessThanOrEqual(0.25);
  });
});
