/**
 * Audio Guide 2.0: availability, language matching, one active track,
 * switching, interruptions, offline mapping, time formatting and where the
 * mini player may appear.
 */
import * as fs from 'fs';
import * as path from 'path';

import { AppState } from 'react-native';

import { miniPlayerPlacement } from '@/components/audio/miniPlayerPlacement';

import { formatAudioTime, isPlayableNow, offlineAvailabilityFor, resolveAudioPlan, type AudioPlan } from './narration';

const mockSpeak = jest.fn();
const mockStop = jest.fn();
jest.mock('expo', () => ({ requireOptionalNativeModule: () => ({}) }));
jest.mock('expo-speech', () => ({ speak: (...args: unknown[]) => mockSpeak(...args), stop: () => mockStop(), getAvailableVoicesAsync: async () => [] }));
jest.mock('@/services/feedback/diagnosticTrail', () => ({ recordDiagnostic: jest.fn() }));

const appStateHandlers: ((state: string) => void)[] = [];
jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
  appStateHandlers.push(handler as (state: string) => void);
  return { remove: () => {} } as ReturnType<typeof AppState.addEventListener>;
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useAudioGuideStore } = require('./useAudioGuideStore') as typeof import('./useAudioGuideStore');

const ttsPlan = (text: string): AudioPlan => ({ kind: 'tts', bcp47: 'ky-KG', voiceId: 'ky', chunks: [text, `${text} 2`] });
const meta = (title: string) => ({ title, route: `/culture/item/${title}` });

describe('availability and language', () => {
  const kgText = { lang: 'kg' as const, text: 'Боз үй - көчмөндөрдүн үйү.' };
  const kyVoice = [{ identifier: 'ky', language: 'ky-KG' }];

  it('no audio at all -> unavailable (the player renders nothing)', () => {
    expect(resolveAudioPlan({ appLanguage: 'kg', narration: null, recorded: null, ttsAvailable: true, voices: kyVoice }).kind).toBe('unavailable');
    expect(resolveAudioPlan({ appLanguage: 'kg', narration: kgText, recorded: null, ttsAvailable: false, voices: kyVoice }).kind).toBe('unavailable');
  });

  it('Kyrgyz text is never read as Russian/English narration', () => {
    const ruVoices = [{ identifier: 'ru', language: 'ru-RU' }];
    expect(resolveAudioPlan({ appLanguage: 'ru', narration: kgText, recorded: null, ttsAvailable: true, voices: ruVoices })).toEqual({ kind: 'unavailable', reason: 'noContentInLanguage' });
    expect(resolveAudioPlan({ appLanguage: 'kg', narration: kgText, recorded: null, ttsAvailable: true, voices: ruVoices })).toEqual({ kind: 'unavailable', reason: 'noVoice' });
  });

  it('a real recording in the app language plays; KG content with a KG voice reads in Kyrgyz', () => {
    expect(resolveAudioPlan({ appLanguage: 'ru', narration: kgText, recorded: 12, ttsAvailable: true, voices: [] }).kind).toBe('recorded');
    const plan = resolveAudioPlan({ appLanguage: 'kg', narration: kgText, recorded: null, ttsAvailable: true, voices: kyVoice });
    expect(plan).toMatchObject({ kind: 'tts', bcp47: 'ky-KG' });
  });
});

describe('one active narration', () => {
  beforeEach(() => {
    useAudioGuideStore.getState().stop();
    mockSpeak.mockClear();
    mockStop.mockClear();
  });

  it('starting B stops A and switches title/progress', () => {
    const store = useAudioGuideStore.getState();
    store.start('a:kg', ttsPlan('A'), meta('a'));
    expect(useAudioGuideStore.getState()).toMatchObject({ sessionKey: 'a:kg', status: 'playing' });
    store.start('b:kg', ttsPlan('B'), meta('b'));
    const state = useAudioGuideStore.getState();
    expect(state.sessionKey).toBe('b:kg');
    expect(state.meta?.title).toBe('b');
    expect(state.progress).toBe(0);
    expect(mockStop).toHaveBeenCalled();
    expect(mockSpeak.mock.calls.at(-1)?.[0]).toBe('B');
  });

  it('pause keeps the position; resume continues from the current sentence', () => {
    const store = useAudioGuideStore.getState();
    store.start('a:kg', ttsPlan('A'), meta('a'));
    // Finish sentence 1 -> sentence 2 starts.
    (mockSpeak.mock.calls[0][1] as { onDone: () => void }).onDone();
    expect(mockSpeak.mock.calls.at(-1)?.[0]).toBe('A 2');
    store.toggle();
    expect(useAudioGuideStore.getState()).toMatchObject({ status: 'paused', progress: 0.5 });
    store.toggle();
    expect(mockSpeak.mock.calls.at(-1)?.[0]).toBe('A 2');
  });

  it('going to the background pauses (never restarts from zero); stopping only affects its own session', () => {
    const store = useAudioGuideStore.getState();
    store.start('a:kg', ttsPlan('A'), meta('a'));
    for (const handler of appStateHandlers) handler('background');
    expect(useAudioGuideStore.getState()).toMatchObject({ status: 'paused', sessionKey: 'a:kg' });
    for (const handler of appStateHandlers) handler('active');
    expect(useAudioGuideStore.getState().status).toBe('paused');
    store.stop('other:kg');
    expect(useAudioGuideStore.getState().sessionKey).toBe('a:kg');
  });

  it('device speech cannot seek; the seek action is a no-op there', () => {
    const store = useAudioGuideStore.getState();
    store.start('a:kg', ttsPlan('A'), meta('a'));
    expect(useAudioGuideStore.getState().canSeek).toBe(false);
    store.seek(0.8);
    expect(useAudioGuideStore.getState().progress).toBe(0);
  });

  it('full-player hosts hide the mini player until they unmount', () => {
    const unregister = useAudioGuideStore.getState().registerHost('a:kg');
    expect(useAudioGuideStore.getState().hosts['a:kg']).toBe(1);
    unregister();
    expect(useAudioGuideStore.getState().hosts['a:kg']).toBeUndefined();
  });

  it('listening never awards progress (audio stays informational)', () => {
    const source = fs.readFileSync(path.join(__dirname, 'useAudioGuideStore.ts'), 'utf8');
    expect(source).not.toMatch(/useProgressStore|apply_reward|award/);
  });
});

describe('offline, time and placement', () => {
  it('maps where the sound comes from', () => {
    expect(offlineAvailabilityFor({ kind: 'tts', bcp47: 'ky-KG', voiceId: null, chunks: ['x'] })).toBe('device');
    expect(offlineAvailabilityFor({ kind: 'recorded', source: 42 })).toBe('bundled');
    expect(offlineAvailabilityFor({ kind: 'recorded', source: { uri: 'file:///data/boz_uy.mp3' } })).toBe('bundled');
    expect(offlineAvailabilityFor({ kind: 'recorded', source: { uri: 'https://cdn.example.org/boz_uy.mp3' } })).toBe('network');
    expect(isPlayableNow('network', true)).toBe(false);
    expect(isPlayableNow('network', false)).toBe(true);
    expect(isPlayableNow('device', true)).toBe(true);
    expect(isPlayableNow('bundled', true)).toBe(true);
  });

  it('formats time', () => {
    expect(formatAudioTime(0)).toBe('0:00');
    expect(formatAudioTime(65.9)).toBe('1:05');
    expect(formatAudioTime(-3)).toBe('0:00');
    expect(formatAudioTime(Number.NaN)).toBe('0:00');
  });

  it('mini player sits above the tab bar on tabs, at the bottom of reading screens, and never on games/labs/map/auth/admin', () => {
    for (const tab of ['/home', '/games', '/explore', '/culture', '/profile']) expect(miniPlayerPlacement(tab)).toBe('aboveTabBar');
    for (const reading of ['/culture/item/boz-uy', '/culture/material/kalpak-history', '/explore/son-kol', '/daily', '/saved', '/trails/horse-culture', '/quests/horse-games', '/culture/crafts', '/culture/shyrdak'])
      expect(miniPlayerPlacement(reading)).toBe('bottom');
    for (const hidden of ['/games/kok-boru', '/culture/oymo/create', '/culture/komuz/learn', '/culture/shyrdak/create', '/culture/boz-uy/build', '/culture/quiz', '/explore/map', '/sign-in', '/admin', '/admin/culture_items', '/onboarding', '/challenges/daily'])
      expect(miniPlayerPlacement(hidden)).toBeNull();
  });
});
