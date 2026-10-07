/**
 * Audio guide lifecycle races, driven by CONTROLLED fake players: every
 * status update, load, seek result and failure happens exactly when the
 * test says so. Device checks (calls, headphones, backgrounding on real
 * hardware) are in docs/DEVICE_QA.md.
 */
import * as fs from 'fs';
import * as path from 'path';

import { AppState } from 'react-native';

import { audioStateLabel } from '@/components/audio/audioStateLabel';

import type { AudioPlan } from './narration';

type Listener = (status: Record<string, unknown>) => void;
type FakePlayer = {
  id: number;
  source: unknown;
  listeners: Listener[];
  isLoaded: boolean;
  currentTime: number;
  removed: boolean;
  play: jest.Mock;
  pause: jest.Mock;
  remove: jest.Mock;
  setPlaybackRate: jest.Mock;
  seekTo: jest.Mock<Promise<void>, [number]>;
  seeks: { seconds: number; resolve: () => void; reject: (error: Error) => void }[];
  emit: (status: Partial<Record<string, unknown>>) => void;
};

const mockPlayers: FakePlayer[] = [];
function mockCreatePlayer(source: unknown): FakePlayer {
  const fake: FakePlayer = {
    id: mockPlayers.length,
    source,
    listeners: [],
    isLoaded: false,
    currentTime: 0,
    removed: false,
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(() => {
      fake.removed = true;
    }),
    setPlaybackRate: jest.fn(),
    seeks: [],
    seekTo: jest.fn(
      (seconds: number) =>
        new Promise<void>((resolve, reject) => {
          fake.seeks.push({
            seconds,
            resolve: () => {
              fake.currentTime = seconds;
              resolve();
            },
            reject,
          });
        }),
    ),
    emit: (status) => {
      for (const listener of [...fake.listeners]) listener({ currentTime: fake.currentTime, duration: 100, playing: false, isBuffering: false, didJustFinish: false, isLoaded: fake.isLoaded, error: undefined, ...status });
    },
  };
  (fake as unknown as { addListener: unknown }).addListener = (_event: string, listener: Listener) => {
    fake.listeners.push(listener);
    return { remove: () => (fake.listeners = fake.listeners.filter((entry) => entry !== listener)) };
  };
  mockPlayers.push(fake);
  return fake;
}

const mockSpeak = jest.fn();
const mockSpeechStop = jest.fn();
jest.mock('expo', () => ({ requireOptionalNativeModule: () => ({}) }));
jest.mock('expo-audio', () => ({ createAudioPlayer: (source: unknown) => mockCreatePlayer(source) }));
jest.mock('expo-speech', () => ({ speak: (...args: unknown[]) => mockSpeak(...args), stop: () => mockSpeechStop(), getAvailableVoicesAsync: async () => [] }));
jest.mock('@/services/feedback/diagnosticTrail', () => ({ recordDiagnostic: jest.fn() }));
jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

// A real (tiny) auth store, so account changes reach every subscriber.
jest.mock('@/store/useAuthStore', () => {
  const { create } = jest.requireActual('zustand');
  return { useAuthStore: create(() => ({ status: 'authenticated', user: { id: 'user-a' } })), registerAccountHooks: jest.fn() };
});

const appStateHandlers: ((state: string) => void)[] = [];
jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
  appStateHandlers.push(handler as (state: string) => void);
  return { remove: () => {} } as ReturnType<typeof AppState.addEventListener>;
});

/* eslint-disable @typescript-eslint/no-require-imports */
const { useAudioGuideStore, LOAD_TIMEOUT_MS } = require('./useAudioGuideStore') as typeof import('./useAudioGuideStore');
const { bindAudioToAccount } = require('./accountBinding') as typeof import('./accountBinding');
const { useAuthStore } = require('@/store/useAuthStore') as { useAuthStore: { setState: (state: unknown) => void } };
const { installListeningTracker } = require('@/features/listening/listeningTracker') as typeof import('@/features/listening/listeningTracker');
const { useListeningStore } = require('@/store/useListeningStore') as typeof import('@/store/useListeningStore');
const i18n = (require('i18next').default ?? require('i18next')) as { emit: (event: string, ...args: unknown[]) => void };
/* eslint-enable @typescript-eslint/no-require-imports */

const recorded = (name: string): AudioPlan => ({ kind: 'recorded', source: { uri: `file:///audio/${name}.mp3` } });
const tts = (name: string): AudioPlan => ({ kind: 'tts', bcp47: 'ky-KG', voiceId: 'ky', chunks: [`${name} 1`, `${name} 2`, `${name} 3`] });
const meta = (name: string) => ({ title: `Title ${name}`, route: `/culture/item/${name}` });
const state = () => useAudioGuideStore.getState();
const lastPlayer = () => mockPlayers[mockPlayers.length - 1];
const flush = () => new Promise((resolve) => setImmediate(resolve));
const speechCall = (index: number) => mockSpeak.mock.calls[index] as [string, { onDone: () => void; onError: () => void }];

const rejections: unknown[] = [];
const onRejection = (reason: unknown) => rejections.push(reason);
beforeAll(() => process.on('unhandledRejection', onRejection));
afterAll(() => process.off('unhandledRejection', onRejection));

beforeEach(() => {
  state().stop();
  mockPlayers.length = 0;
  mockSpeak.mockClear();
  mockSpeechStop.mockClear();
  rejections.length = 0;
  useAuthStore.setState({ status: 'authenticated', user: { id: 'user-a' } });
});
afterEach(async () => {
  await flush();
  expect(rejections).toEqual([]);
});

describe('rapid switching A -> B', () => {
  it("a released recording's late updates never touch B", () => {
    state().start('a:kg', recorded('a'), meta('a'));
    const a = lastPlayer();
    a.isLoaded = true;
    a.emit({ isLoaded: true });
    state().start('b:kg', recorded('b'), meta('b'));
    expect(a.removed).toBe(true);
    // Updates A had queued arrive after the switch.
    for (const listener of a.listeners) listener({ currentTime: 55, duration: 300, playing: true, isBuffering: false, didJustFinish: false, isLoaded: true });
    a.emit({ currentTime: 99, didJustFinish: true });
    expect(state()).toMatchObject({ sessionKey: 'b:kg', meta: { title: 'Title b' }, elapsed: null, status: 'loading', progress: 0 });
  });

  it('A updates that fire synchronously while A is being stopped are ignored', () => {
    state().start('a:kg', recorded('a'), meta('a'));
    const a = lastPlayer();
    a.isLoaded = true;
    a.emit({});
    a.pause.mockImplementation(() => a.emit({ currentTime: 42, playing: false }));
    state().start('b:kg', tts('b'), meta('b'));
    expect(state()).toMatchObject({ sessionKey: 'b:kg', status: 'playing', elapsed: null, chunk: 0 });
  });

  it("a stopped utterance's onDone / onError never advance or fail B", () => {
    state().start('a:kg', tts('a'), meta('a'));
    const [, aCallbacks] = speechCall(0);
    state().start('b:kg', tts('b'), meta('b'));
    aCallbacks.onDone();
    aCallbacks.onError();
    expect(state()).toMatchObject({ sessionKey: 'b:kg', status: 'playing', chunk: 0 });
    expect(mockSpeak.mock.calls.map(([text]) => text)).toEqual(['a 1', 'b 1']);
  });

  it('a seek from A that resolves after switching never plays A', async () => {
    state().start('a:kg', recorded('a'), meta('a'), { type: 'seconds', value: 30 });
    const a = lastPlayer();
    a.isLoaded = true;
    a.emit({});
    expect(a.seekTo).toHaveBeenCalledWith(30);
    state().start('b:kg', recorded('b'), meta('b'));
    a.seeks[0].resolve();
    await flush();
    expect(a.play).not.toHaveBeenCalled();
    expect(state().sessionKey).toBe('b:kg');
  });

  it('only one engine exists at a time', () => {
    state().start('a:kg', recorded('a'), meta('a'));
    state().start('b:kg', tts('b'), meta('b'));
    state().start('c:kg', recorded('c'), meta('c'));
    expect(mockPlayers.filter((player) => !player.removed)).toHaveLength(1);
    expect(mockSpeechStop).toHaveBeenCalled();
  });
});

describe('resume at the saved position', () => {
  it('waits for the player to load, seeks, THEN plays', async () => {
    state().start('a:kg', recorded('a'), meta('a'), { type: 'seconds', value: 30 });
    const a = lastPlayer();
    expect(state().status).toBe('loading');
    expect(a.seekTo).not.toHaveBeenCalled();
    expect(a.play).not.toHaveBeenCalled();
    a.emit({ isLoaded: false }); // still loading
    expect(a.seekTo).not.toHaveBeenCalled();
    a.isLoaded = true;
    a.emit({});
    expect(a.seekTo).toHaveBeenCalledWith(30);
    expect(a.play).not.toHaveBeenCalled();
    a.seeks[0].resolve();
    await flush();
    expect(a.play).toHaveBeenCalledTimes(1);
    expect(state()).toMatchObject({ status: 'playing', elapsed: 30 });
  });

  it('a rejected seek is handled: playback starts, no unhandled rejection', async () => {
    state().start('a:kg', recorded('a'), meta('a'), { type: 'seconds', value: 30 });
    const a = lastPlayer();
    a.isLoaded = true;
    a.emit({});
    a.seeks[0].reject(new Error('seek failed'));
    await flush();
    expect(a.play).toHaveBeenCalled();
    expect(state()).toMatchObject({ status: 'playing', elapsed: 0 });
  });

  it('device speech resumes at the saved section', () => {
    state().start('a:kg', tts('a'), meta('a'), { type: 'chunk', value: 2 });
    expect(mockSpeak.mock.calls[0][0]).toBe('a 3');
    expect(state().chunk).toBe(2);
  });

  it('paused while loading: never starts by itself once loaded', async () => {
    state().start('a:kg', recorded('a'), meta('a'), { type: 'seconds', value: 10 });
    for (const handler of appStateHandlers) handler('background');
    expect(state().status).toBe('paused');
    const a = lastPlayer();
    a.isLoaded = true;
    a.emit({});
    a.seeks[0]?.resolve();
    await flush();
    expect(a.play).not.toHaveBeenCalled();
    for (const handler of appStateHandlers) handler('active');
    expect(state().status).toBe('paused');
  });
});

describe('rejected / throwing operations and explicit retry', () => {
  it('a failing seek while playing shows where the player really is', async () => {
    state().start('a:kg', recorded('a'), meta('a'));
    const a = lastPlayer();
    a.isLoaded = true;
    a.emit({});
    await flush();
    a.emit({ currentTime: 20, playing: true });
    state().seek(0.8);
    expect(state().elapsed).toBe(80);
    a.seeks[0].reject(new Error('nope'));
    await flush();
    expect(state().elapsed).toBe(20);
  });

  it('play() throwing -> error; Try again builds a NEW player at the same position', async () => {
    state().start('a:kg', recorded('a'), meta('a'));
    const a = lastPlayer();
    a.isLoaded = true;
    a.emit({});
    await flush();
    a.emit({ currentTime: 40, playing: true });
    a.pause.mockImplementation(() => {
      throw new Error('native player gone');
    });
    state().toggle();
    expect(state()).toMatchObject({ status: 'error', errorKind: 'recording', sessionKey: 'a:kg' });
    state().toggle(); // = Try again
    const retried = lastPlayer();
    expect(retried).not.toBe(a);
    expect(a.removed).toBe(true);
    expect(state().status).toBe('loading');
    retried.isLoaded = true;
    retried.emit({});
    expect(retried.seekTo).toHaveBeenCalledWith(40);
    retried.seeks[0].resolve();
    await flush();
    expect(state()).toMatchObject({ status: 'playing', sessionKey: 'a:kg', meta: { title: 'Title a' } });
  });

  it('a player that never loads becomes a recoverable error', () => {
    jest.useFakeTimers();
    try {
      state().start('a:kg', recorded('a'), meta('a'));
      jest.advanceTimersByTime(LOAD_TIMEOUT_MS + 1);
      expect(state()).toMatchObject({ status: 'error', errorKind: 'recording' });
      state().retry();
      expect(mockPlayers).toHaveLength(2);
      expect(state().status).toBe('loading');
    } finally {
      jest.useRealTimers();
    }
  });

  it('a player error status is an error, not a stuck "playing"', () => {
    state().start('a:kg', recorded('a'), meta('a'));
    lastPlayer().emit({ error: 'decode failed' });
    expect(state().status).toBe('error');
  });

  it('device speech failing (or throwing) is an error with a speech message; retry re-reads the section', () => {
    state().start('a:kg', tts('a'), meta('a'));
    speechCall(0)[1].onDone();
    speechCall(1)[1].onError();
    expect(state()).toMatchObject({ status: 'error', errorKind: 'speech', chunk: 1 });
    mockSpeak.mockImplementationOnce(() => {
      throw new Error('engine gone');
    });
    state().toggle();
    expect(state()).toMatchObject({ status: 'error', errorKind: 'speech' });
    state().toggle();
    expect(state()).toMatchObject({ status: 'playing', chunk: 1 });
    expect(mockSpeak.mock.calls.at(-1)?.[0]).toBe('a 2');
  });
});

describe('language and account changes stop the right session', () => {
  it('a language change stops narration', () => {
    state().start('a:kg', tts('a'), meta('a'));
    i18n.emit('languageChanged', 'ru');
    expect(state()).toMatchObject({ sessionKey: null, status: 'idle' });
  });

  it('an account change stops narration, and no listening is saved for the next account', async () => {
    const unbind = bindAudioToAccount();
    installListeningTracker();
    useListeningStore.setState({ saved: {}, isLoaded: true });
    try {
      state().start('a:kg', tts('a'), meta('a'));
      expect(useListeningStore.getState().saved['user-a']).toBeDefined();
      useAuthStore.setState({ status: 'authenticated', user: { id: 'user-b' } });
      expect(state()).toMatchObject({ sessionKey: null, status: 'idle' });
      // A's stopped speech reporting late changes nothing anywhere.
      speechCall(0)[1].onDone();
      expect(useListeningStore.getState().saved['user-b']).toBeUndefined();
      // B's own session is B's.
      state().start('a:kg', tts('a'), meta('a'));
      expect(useListeningStore.getState().saved['user-b']).toBeDefined();
    } finally {
      unbind();
    }
  });
});

describe('full and mini player agree', () => {
  it('both players use the same status line', () => {
    for (const file of ['../../components/audio/AudioGuidePlayer.tsx', '../../components/audio/AudioMiniPlayer.tsx']) {
      expect(fs.readFileSync(path.join(__dirname, file), 'utf8')).toContain('audioStateLabel(t, status, errorKind)');
    }
    const t = (key: string) => key;
    expect(audioStateLabel(t, 'loading', null)).toBe('audioGuide.loading');
    expect(audioStateLabel(t, 'error', 'speech')).toBe('audioGuide.errorSpeech');
    expect(audioStateLabel(t, 'error', 'recording')).toBe('audioGuide.error');
    expect(audioStateLabel(t, 'paused', null)).toBe('audioGuide.paused');
  });

  it('the mini player keeps honouring reduced motion', () => {
    const mini = fs.readFileSync(path.join(__dirname, '../../components/audio/AudioMiniPlayer.tsx'), 'utf8');
    expect(mini).toContain('entering={reducedMotion ? undefined');
    expect(mini).toContain('exiting={reducedMotion ? undefined');
  });
});
