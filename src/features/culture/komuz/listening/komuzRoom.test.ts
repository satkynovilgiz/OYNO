import * as fs from 'fs';
import * as path from 'path';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';

import { addRecent, filterTracks, MAX_RECENT, nextIndex, previousIndex, realDuration, showFavoritesFilter, spokenTime, toggleId } from './komuzQueue';

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

const appStateHandlers: ((state: string) => void)[] = [];
jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
  appStateHandlers.push(handler as (state: string) => void);
  return { remove: () => {} } as ReturnType<typeof AppState.addEventListener>;
});

/* eslint-disable @typescript-eslint/no-require-imports */
const { useKomuzPlayerStore } = require('./useKomuzPlayerStore') as typeof import('./useKomuzPlayerStore');
const { useAudioGuideStore } = require('@/services/audioGuide/useAudioGuideStore') as typeof import('@/services/audioGuide/useAudioGuideStore');
const { useAuthStore } = require('@/store/useAuthStore') as typeof import('@/store/useAuthStore');
const { komuzTracks } = require('@/features/culture/audioData') as typeof import('@/features/culture/audioData');
const { EMPTY_LIBRARY, mergeLibrary, ownerLibrary, useKomuzLibraryStore } = require('@/store/useKomuzLibraryStore') as typeof import('@/store/useKomuzLibraryStore');
/* eslint-enable @typescript-eslint/no-require-imports */

const ids = komuzTracks.map((entry) => entry.id);
const active = () => players.filter((player) => !player.removed);

describe('Komuz queue rules', () => {
  it('next/previous stop at the ends (no wrap)', () => {
    expect(nextIndex(3, 1)).toBe(2);
    expect(nextIndex(3, 2)).toBeNull();
    expect(previousIndex(1)).toBe(0);
    expect(previousIndex(0)).toBeNull();
  });

  it('favorites toggle, filter, and the filter only shows when useful', () => {
    expect(toggleId(toggleId([], 'a'), 'a')).toEqual([]);
    expect(filterTracks(komuzTracks, 'favorites', ['chon-kerbez']).map((entry) => entry.id)).toEqual(['chon-kerbez']);
    expect(showFavoritesFilter([], ids)).toBe(false);
    expect(showFavoritesFilter(['gone'], ids)).toBe(false);
    expect(showFavoritesFilter(['chon-kerbez'], ids)).toBe(true);
  });

  it('recents: newest first, capped, no duplicates', () => {
    let list: string[] = [];
    for (const id of ids.slice(0, 7)) list = addRecent(list, id);
    list = addRecent(list, ids[3]);
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0]).toBe(ids[3]);
    expect(new Set(list).size).toBe(list.length);
  });

  it('no fabricated durations: only a real, positive duration counts', () => {
    expect(realDuration(0)).toBeNull();
    expect(realDuration(Number.NaN)).toBeNull();
    expect(realDuration(undefined)).toBeNull();
    expect(realDuration(260)).toBe(260);
    const screen = fs.readFileSync(path.join(__dirname, 'KomuzListeningRoomScreen.tsx'), 'utf8');
    expect(screen).toMatch(/current && duration !== null \? \(\s*<Scrubber/);
  });

  it('spoken time for screen readers', () => {
    const t = (key: string, options?: Record<string, unknown>) => `${options?.count} ${key.endsWith('minutes') ? 'min' : 'sec'}`;
    expect(spokenTime(134, t)).toBe('2 min 14 sec');
  });

  it('unconfirmed track metadata is preserved exactly (no guessed titles)', () => {
    const unconfirmed = komuzTracks.filter((entry) => !entry.titleConfirmed);
    expect(unconfirmed.length).toBeGreaterThan(0);
    for (const entry of unconfirmed) {
      expect(entry.title).toMatch(/^Комуз күүсү №\d+$/);
      expect(entry.performer).toBeUndefined();
    }
  });
});

describe('Komuz shared player', () => {
  beforeEach(() => {
    useKomuzPlayerStore.getState().stop();
    useAudioGuideStore.getState().stop();
  });

  it('only one active track at a time', () => {
    useKomuzPlayerStore.getState().play(ids[0], ids);
    useKomuzPlayerStore.getState().play(ids[1], ids);
    expect(active()).toHaveLength(1);
    expect(useKomuzPlayerStore.getState()).toMatchObject({ currentTrackId: ids[1], queueIndex: 1, playing: true });
  });

  it('next/previous move through the queue and stop at the boundaries', () => {
    useKomuzPlayerStore.getState().play(ids[0], ids.slice(0, 2));
    useKomuzPlayerStore.getState().previous();
    expect(useKomuzPlayerStore.getState().currentTrackId).toBe(ids[0]);
    useKomuzPlayerStore.getState().next();
    expect(useKomuzPlayerStore.getState().currentTrackId).toBe(ids[1]);
    useKomuzPlayerStore.getState().next();
    expect(useKomuzPlayerStore.getState().currentTrackId).toBe(ids[1]);
  });

  it('auto-advance happens only on the player\'s own finished signal', () => {
    useKomuzPlayerStore.getState().play(ids[0], ids.slice(0, 2));
    active()[0].listener!({ currentTime: 200, duration: 200, playing: false, didJustFinish: true });
    expect(useKomuzPlayerStore.getState().currentTrackId).toBe(ids[1]);
    active()[0].listener!({ currentTime: 90, duration: 90, playing: false, didJustFinish: true });
    expect(useKomuzPlayerStore.getState()).toMatchObject({ currentTrackId: ids[1], playing: false });
  });

  it('music starting stops the Audio Guide', () => {
    useAudioGuideStore.setState({ sessionKey: 'culture_item:komuz:kg', status: 'playing' });
    useKomuzPlayerStore.getState().play(ids[0], ids);
    expect(useAudioGuideStore.getState().sessionKey).toBeNull();
  });

  it('the Audio Guide starting pauses the music', () => {
    useKomuzPlayerStore.getState().play(ids[0], ids);
    useAudioGuideStore.setState({ sessionKey: 'culture_item:komuz:kg', status: 'playing' });
    expect(useKomuzPlayerStore.getState().playing).toBe(false);
    expect(active()[0].pause).toHaveBeenCalled();
  });

  it('background pauses; coming back stays paused', () => {
    useKomuzPlayerStore.getState().play(ids[0], ids);
    appStateHandlers.forEach((handler) => handler('background'));
    expect(useKomuzPlayerStore.getState().playing).toBe(false);
    appStateHandlers.forEach((handler) => handler('active'));
    expect(useKomuzPlayerStore.getState().playing).toBe(false);
  });

  it('an account change stops the music', () => {
    useKomuzPlayerStore.getState().play(ids[0], ids);
    useAuthStore.setState({ user: { id: 'user-b' } as never });
    expect(useKomuzPlayerStore.getState().currentTrackId).toBeNull();
    expect(active()).toHaveLength(0);
  });
});

describe('Komuz library (favorites + recents)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useKomuzLibraryStore.setState({ isLoaded: false, saved: {} });
  });

  it('per-owner favorites; guest persists on device; guest adopted; A never seen by B', async () => {
    await useKomuzLibraryStore.getState().load();
    useKomuzLibraryStore.getState().toggleFavorite('guest', 'chon-kerbez');
    await new Promise((resolve) => setTimeout(resolve, 0));
    useKomuzLibraryStore.setState({ isLoaded: false, saved: {} });
    await useKomuzLibraryStore.getState().load();
    expect(ownerLibrary(useKomuzLibraryStore.getState().saved, 'guest').favorites).toEqual(['chon-kerbez']);
    useKomuzLibraryStore.getState().adoptGuest('user-a');
    useKomuzLibraryStore.getState().toggleFavorite('user-a', 'ak-maral-min');
    const saved = useKomuzLibraryStore.getState().saved;
    expect(ownerLibrary(saved, 'user-a').favorites).toEqual(['chon-kerbez', 'ak-maral-min']);
    expect(ownerLibrary(saved, 'guest')).toEqual(EMPTY_LIBRARY);
    expect(ownerLibrary(saved, 'user-b')).toEqual(EMPTY_LIBRARY);
    expect(mergeLibrary({ favorites: ['a'], recent: ['x'] }, { favorites: ['a', 'b'], recent: ['y'] })).toEqual({ favorites: ['a', 'b'], recent: ['x', 'y'] });
  });

  it('no play counts, ranks or rewards', () => {
    for (const file of ['KomuzListeningRoomScreen.tsx', 'useKomuzPlayerStore.ts']) {
      const code = fs.readFileSync(path.join(__dirname, file), 'utf8');
      expect(code).not.toMatch(/playCount|leaderboard|addXp|addCoins|streak/i);
    }
  });

  it('KG / RU / EN UI keys', () => {
    for (const dict of [kg, ru, en]) {
      const room = (dict as unknown as { komuzRoom: Record<string, string> }).komuzRoom;
      for (const key of ['listen', 'nowPlaying', 'allTracks', 'favorites', 'recentlyListened', 'previous', 'next', 'play', 'pause', 'favorite', 'removeFavorite', 'titleUnconfirmed', 'availableOffline']) expect(room[key]).toBeTruthy();
    }
  });
});
