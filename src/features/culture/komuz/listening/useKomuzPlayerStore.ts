import type { AudioPlayer, AudioStatus } from 'expo-audio';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { komuzTracks, type KomuzTrack } from '@/features/culture/audioData';
import { track as trackEvent } from '@/services/analytics/analytics';
import { useAudioGuideStore } from '@/services/audioGuide/useAudioGuideStore';
import { useAuthStore } from '@/store/useAuthStore';

import { MEANINGFUL_SECONDS, nextIndex, previousIndex, realDuration } from './komuzQueue';

type KomuzPlayerState = {
  /** Track ids in play order (the list the user started from). */
  queue: string[];
  queueIndex: number;
  currentTrackId: string | null;
  playing: boolean;
  /** Seconds, as reported by the player. */
  position: number;
  /** Seconds; null until the player reports a real duration. */
  duration: number | null;
  /** Called once per started track after meaningful playback (recents). */
  onListened: ((trackId: string) => void) | null;
  /** The last track that really played to its end (player's own signal). */
  lastFinished: { trackId: string; at: number } | null;
  play: (trackId: string, queue?: string[]) => void;
  /** Resume a saved point: plays the track, then seeks once the player
   * reports a real duration. Only from a user tap. */
  playFrom: (trackId: string, seconds: number) => void;
  toggle: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  /** Seconds; ignored without a real duration. */
  seek: (seconds: number) => void;
  stop: () => void;
  setOnListened: (handler: ((trackId: string) => void) | null) => void;
};

// The ONE komuz engine - module level, so two tracks can never play at once.
let player: AudioPlayer | null = null;
let subscription: { remove: () => void } | null = null;
let listenedReported = false;
let listenersInstalled = false;
let pendingSeek: number | null = null;

function trackById(id: string): KomuzTrack | undefined {
  return komuzTracks.find((entry) => entry.id === id);
}

/**
 * The shared komuz music session (Listening Room, the Komuz lesson and
 * culture-item playlists all use it). Policy, deterministic:
 *  - music starts  -> the Audio Guide stops;
 *  - the Audio Guide starts -> music pauses;
 *  - app goes to the background -> pauses; it never resumes on its own;
 *  - the account changes -> music stops.
 * No background audio, no streaming: bundled tracks only.
 */
export const useKomuzPlayerStore = create<KomuzPlayerState>((set, get) => {
  function release() {
    try {
      subscription?.remove();
      player?.pause();
      player?.remove();
    } catch {
      // Already released.
    }
    player = null;
    subscription = null;
  }

  function installListeners() {
    if (listenersInstalled) return;
    listenersInstalled = true;
    AppState.addEventListener('change', (state) => {
      if (state === 'background') get().pause();
    });
    useAudioGuideStore.subscribe((state, previous) => {
      if (state.sessionKey && state.sessionKey !== previous.sessionKey) get().pause();
      if (state.status === 'playing' && previous.status !== 'playing') get().pause();
    });
    let owner = useAuthStore.getState().user?.id ?? null;
    useAuthStore.subscribe((state) => {
      const next = state.user?.id ?? null;
      if (next === owner) return;
      owner = next;
      get().stop();
    });
  }

  function load(index: number, queue: string[]) {
    const id = queue[index];
    const entry = id ? trackById(id) : undefined;
    if (!entry) return;
    installListeners();
    release();
    // Music and narration never overlap.
    useAudioGuideStore.getState().stop();
    listenedReported = false;
    set({ queue, queueIndex: index, currentTrackId: entry.id, playing: false, position: 0, duration: null });
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createAudioPlayer } = require('expo-audio') as typeof import('expo-audio');
      player = createAudioPlayer(entry.source, { updateInterval: 250 });
      subscription = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
        if (get().currentTrackId !== entry.id) return;
        const position = status.currentTime ?? 0;
        set({ position, duration: realDuration(status.duration), playing: !!status.playing && !status.didJustFinish });
        const duration = realDuration(status.duration);
        if (pendingSeek !== null && duration !== null) {
          const target = Math.min(pendingSeek, Math.max(0, duration - 1));
          pendingSeek = null;
          void player?.seekTo(target);
          set({ position: target });
        }
        if (!listenedReported && position >= MEANINGFUL_SECONDS) {
          listenedReported = true;
          get().onListened?.(entry.id);
        }
        // Auto-advance ONLY on the player's own "finished" signal - never a timer.
        if (status.didJustFinish) {
          set({ lastFinished: { trackId: entry.id, at: Date.now() } });
          const following = nextIndex(get().queue.length, get().queueIndex);
          if (following === null) set({ playing: false });
          else load(following, get().queue);
        }
      });
      player.play();
      set({ playing: true });
      trackEvent('komuz_track_started', { track_id: entry.id });
    } catch {
      set({ playing: false });
    }
  }

  return {
    queue: [],
    queueIndex: 0,
    currentTrackId: null,
    playing: false,
    position: 0,
    duration: null,
    onListened: null,
    lastFinished: null,

    playFrom: (trackId, seconds) => {
      get().play(trackId);
      pendingSeek = seconds > 0 ? seconds : null;
    },

    play: (trackId, queue) => {
      const order = queue && queue.includes(trackId) ? queue : komuzTracks.map((entry) => entry.id);
      if (get().currentTrackId === trackId && player) {
        if (!get().playing) get().toggle();
        set({ queue: order, queueIndex: order.indexOf(trackId) });
        return;
      }
      load(order.indexOf(trackId), order);
    },

    toggle: () => {
      if (!player) return;
      if (get().playing) {
        player.pause();
        set({ playing: false });
      } else {
        useAudioGuideStore.getState().stop();
        player.play();
        set({ playing: true });
      }
    },

    pause: () => {
      if (!player || !get().playing) return;
      player.pause();
      set({ playing: false });
    },

    next: () => {
      const following = nextIndex(get().queue.length, get().queueIndex);
      if (following !== null) load(following, get().queue);
    },

    previous: () => {
      const before = previousIndex(get().queueIndex);
      if (before !== null) load(before, get().queue);
    },

    seek: (seconds) => {
      const duration = get().duration;
      if (!player || duration === null) return;
      const clamped = Math.min(duration, Math.max(0, seconds));
      void player.seekTo(clamped);
      set({ position: clamped });
    },

    stop: () => {
      release();
      set({ currentTrackId: null, playing: false, position: 0, duration: null });
    },

    setOnListened: (handler) => set({ onListened: handler }),
  };
});

let hosts = 0;

/** Screens that show komuz controls (Listening Room, the Komuz lesson,
 * culture-item playlists). No global mini player in v1: when the LAST
 * such screen closes, the music stops - it never keeps playing with no
 * visible control. Returns the release function. */
export function registerKomuzHost(): () => void {
  hosts += 1;
  return () => {
    hosts -= 1;
    if (hosts <= 0) {
      hosts = 0;
      useKomuzPlayerStore.getState().stop();
    }
  };
}
