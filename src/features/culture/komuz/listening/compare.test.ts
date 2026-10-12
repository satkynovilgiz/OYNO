import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

import { activeSide, canStart, newComparison, normalizeComparisons, rememberedPosition, rememberPosition, setNote, switchPlan, type Comparison } from './compareModel';

type Listener = (status: Record<string, unknown>) => void;
type MockPlayer = { source: unknown; playing: boolean; removed: boolean; listener: Listener | null; play: jest.Mock; pause: jest.Mock; seekTo: jest.Mock; remove: () => void; addListener: (event: string, listener: Listener) => { remove: () => void } };
const players: MockPlayer[] = [];
jest.mock('expo-audio', () => ({
  createAudioPlayer: (source: unknown): MockPlayer => {
    const player: MockPlayer = {
      source,
      playing: false,
      removed: false,
      listener: null,
      play: jest.fn(() => (player.playing = true)),
      pause: jest.fn(() => (player.playing = false)),
      seekTo: jest.fn(async () => undefined),
      remove: () => (player.removed = true),
      addListener: (_event, listener) => {
        player.listener = listener;
        return { remove: () => (player.listener = null) };
      },
    };
    players.push(player);
    return player;
  },
}));
jest.mock('@/services/supabase/client', () => ({ supabase: { auth: { onAuthStateChange: jest.fn() }, rpc: jest.fn() } }));
jest.mock('@/services/analytics/analytics', () => ({ track: jest.fn() }));
jest.mock('expo', () => ({ requireOptionalNativeModule: () => null }));
jest.mock('@/services/feedback/diagnosticTrail', () => ({ recordDiagnostic: jest.fn() }));
jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: () => {} }) as ReturnType<typeof AppState.addEventListener>);

/* eslint-disable @typescript-eslint/no-require-imports */
const { useKomuzPlayerStore } = require('./useKomuzPlayerStore') as typeof import('./useKomuzPlayerStore');
const { useListeningCompareStore, ownerComparisons, LISTENING_COMPARE_KEY } = require('@/store/useListeningCompareStore') as typeof import('@/store/useListeningCompareStore');
const { komuzTracks } = require('@/features/culture/audioData') as typeof import('@/features/culture/audioData');
/* eslint-enable @typescript-eslint/no-require-imports */

const [A, B] = komuzTracks;
const comparison: Comparison = newComparison('c1', { trackId: A.id, title: A.title }, { trackId: B.id, title: B.title }, '2026-10-12T00:00:00Z');
const available = (id: string) => komuzTracks.some((entry) => entry.id === id);
const live = () => players.filter((player) => !player.removed);
const report = (player: MockPlayer, status: Record<string, unknown>) => player.listener?.({ playing: true, currentTime: 0, duration: 120, ...status });

describe('player coordination (the real single komuz player)', () => {
  beforeEach(() => {
    useKomuzPlayerStore.getState().stop();
    players.length = 0;
  });
  it('switching to B stops A: never two recordings at once', () => {
    useKomuzPlayerStore.getState().playFrom(A.id, 0, [A.id]);
    expect(live()).toHaveLength(1);
    const first = live()[0];
    useKomuzPlayerStore.getState().playFrom(B.id, 0, [B.id]);
    expect(first.removed).toBe(true);
    expect(first.pause).toHaveBeenCalled();
    expect(live()).toHaveLength(1);
    expect(useKomuzPlayerStore.getState().currentTrackId).toBe(B.id);
  });
  it('returning seeks to the remembered point only once the player reports a real duration', () => {
    useKomuzPlayerStore.getState().playFrom(A.id, 42, [A.id]);
    const player = live()[0];
    report(player, { duration: 0 }); // no real duration yet
    expect(player.seekTo).not.toHaveBeenCalled();
    report(player, { duration: 120 });
    expect(player.seekTo).toHaveBeenCalledWith(42);
  });
  it('a comparison recording never auto-advances into a third recording', () => {
    useKomuzPlayerStore.getState().playFrom(A.id, 0, [A.id]);
    report(live()[0], { didJustFinish: true, playing: false, currentTime: 120 });
    expect(live()).toHaveLength(1);
    expect(useKomuzPlayerStore.getState()).toMatchObject({ currentTrackId: A.id, playing: false });
  });
});

describe('switch plan and separate positions', () => {
  it('leaving A remembers its position; B starts from its own remembered point', () => {
    rememberPosition('guest', 'c1', 'b', 30);
    const plan = switchPlan(comparison, 'a', 'b', { currentTrackId: A.id, position: 75.5, duration: 120 }, rememberedPosition('guest', 'c1', 'b'), available);
    expect(plan).toEqual({ leave: { side: 'a', seconds: 75.5 }, start: { kind: 'playFrom', trackId: B.id, seconds: 30 } });
  });
  it('positions are per owner, comparison and side', () => {
    rememberPosition('user-a', 'c9', 'a', 12);
    expect(rememberedPosition('user-a', 'c9', 'a')).toBe(12);
    expect(rememberedPosition('user-a', 'c9', 'b')).toBe(0);
    expect(rememberedPosition('user-b', 'c9', 'a')).toBe(0);
    rememberPosition('user-a', 'c9', 'a', Number.NaN);
    expect(rememberedPosition('user-a', 'c9', 'a')).toBe(12);
  });
  it('the same recording already loaded is not reloaded', () => {
    expect(switchPlan(comparison, 'a', 'a', { currentTrackId: A.id, position: 5, duration: 120 }, 0, available).start).toEqual({ kind: 'already' });
    expect(activeSide(comparison, B.id)).toBe('b');
    expect(activeSide(comparison, 'other')).toBeNull();
  });
  it('a missing recording is reported; the other side is unaffected', () => {
    const gone = { ...comparison, b: { trackId: 'removed-recording', title: 'Old title' } };
    expect(switchPlan(gone, 'a', 'b', { currentTrackId: A.id, position: 9, duration: 120 }, 0, available)).toEqual({ leave: { side: 'a', seconds: 9 }, start: { kind: 'missing' } });
    expect(canStart(A.id, 'removed-recording', available)).toBe(false);
    expect(canStart(A.id, A.id, available)).toBe(false);
    expect(canStart(A.id, B.id, available)).toBe(true);
  });
});

describe('comparisons store', () => {
  const store = () => useListeningCompareStore.getState();
  beforeEach(async () => {
    await AsyncStorage.clear();
    useListeningCompareStore.setState({ status: 'idle', saved: {} });
    await store().load();
  });
  it('moments, note and per-owner records', async () => {
    expect(await store().create('user-a', 'c1', comparison.a, comparison.b)).toBe(true);
    expect(await store().saveMoment('user-a', 'c1', 'a', { momentId: 'm1', seconds: 12.34 })).toBe(true);
    expect(await store().saveMoment('user-a', 'c1', 'b', { momentId: 'm2', seconds: 40 })).toBe(true);
    expect(await store().saveNote('user-a', 'c1', 'B feels slower to me.')).toBe(true);
    expect(ownerComparisons(store().saved, 'user-a').c1).toMatchObject({ moments: { a: { momentId: 'm1', seconds: 12.3 }, b: { seconds: 40 } }, note: 'B feels slower to me.' });
    expect(ownerComparisons(store().saved, 'user-b')).toEqual({});
    expect(await store().saveNote('user-b', 'c1', 'not mine')).toBe(false);
  });
  it('a failed save keeps the old note (the screen keeps the edit for Retry)', async () => {
    await store().create('guest', 'c1', comparison.a, comparison.b);
    await store().saveNote('guest', 'c1', 'first');
    const real = AsyncStorage.setItem;
    AsyncStorage.setItem = () => Promise.reject(new Error('disk full'));
    try {
      expect(await store().saveNote('guest', 'c1', 'second')).toBe(false);
    } finally {
      AsyncStorage.setItem = real;
    }
    expect(ownerComparisons(store().saved, 'guest').c1.note).toBe('first');
  });
  it('a missing recording keeps the stored comparison note and moment', async () => {
    const stored = { guest: { c1: { ...comparison, b: { trackId: 'removed-recording', title: 'Removed' }, moments: { b: { momentId: 'm9', seconds: 20 } }, note: 'Kept' } } };
    await AsyncStorage.setItem(LISTENING_COMPARE_KEY, JSON.stringify(stored));
    useListeningCompareStore.setState({ status: 'idle', saved: {} });
    await store().load();
    expect(ownerComparisons(store().saved, 'guest').c1).toMatchObject({ note: 'Kept', moments: { b: { seconds: 20 } }, b: { title: 'Removed' } });
  });
  it('notes are cleaned and unchanged notes are no-ops', () => {
    const noted = setNote(comparison, 'a <b>', 'T');
    expect(noted.note).toBe('a b');
    expect(setNote(noted, 'a b', 'T2')).toBe(noted);
    expect(normalizeComparisons({ bad: { id: 'other' } })).toEqual({});
  });
});
