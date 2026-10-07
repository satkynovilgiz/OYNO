import type { AudioPlayer, AudioStatus } from 'expo-audio';
import { requireOptionalNativeModule } from 'expo';
import i18n from 'i18next';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';

import { recordDiagnostic } from '@/services/feedback/diagnosticTrail';

import type { AudioPlan, VoiceInfo } from './narration';

type SpeechModule = typeof import('expo-speech');

/**
 * expo-speech resolves its native module at import time and throws if it's
 * missing - true for any build installed before it was added (an EAS OTA
 * update can't ship native code). Checked first, then required lazily;
 * on web it uses the browser's speechSynthesis when present.
 */
let speechModule: SpeechModule | null | undefined;
function getSpeech(): SpeechModule | null {
  if (speechModule !== undefined) return speechModule;
  try {
    const available =
      Platform.OS === 'web' ? typeof window !== 'undefined' && 'speechSynthesis' in window : !!requireOptionalNativeModule('ExpoSpeech');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    speechModule = available ? (require('expo-speech') as SpeechModule) : null;
    if (!speechModule) recordDiagnostic('native_unavailable', 'speech');
  } catch {
    speechModule = null;
  }
  return speechModule;
}

export function isSpeechEngineAvailable(): boolean {
  return !!getSpeech();
}

let voicesPromise: Promise<VoiceInfo[]> | null = null;
/** Device voices, fetched once per app run. */
export function loadVoices(): Promise<VoiceInfo[]> {
  const speech = getSpeech();
  if (!speech) return Promise.resolve([]);
  if (!voicesPromise) {
    voicesPromise = speech
      .getAvailableVoicesAsync()
      .then((voices) => voices.map((voice) => ({ identifier: voice.identifier, language: voice.language })))
      .catch(() => []);
    // Browsers often report an empty list until voices finish loading -
    // don't cache that as the final answer.
    void voicesPromise.then((voices) => {
      if (voices.length === 0) voicesPromise = null;
    });
  }
  return voicesPromise;
}

export type AudioGuideStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'finished' | 'error';
export type PlaybackRate = 1 | 1.25 | 1.5;
export const PLAYBACK_RATES: PlaybackRate[] = [1, 1.25, 1.5];
/** A recording that hasn't loaded by then is reported as an error (with Try again). */
export const LOAD_TIMEOUT_MS = 15000;

/** What the mini player needs to show and reopen the narration. */
export type AudioSessionMeta = { title: string; route: string | null };

type AudioGuideState = {
  sessionKey: string | null;
  meta: AudioSessionMeta | null;
  status: AudioGuideStatus;
  /** What failed, for the message: the recording, or the device's speech. */
  errorKind: 'recording' | 'speech' | null;
  /** 0..1 */
  progress: number;
  /** Seconds - only known for recorded audio. */
  elapsed: number | null;
  duration: number | null;
  rate: PlaybackRate;
  /** Only recorded audio can seek; device speech reads sentence by sentence. */
  canSeek: boolean;
  /** Device speech: the sentence-sized chunk being read (null for recordings). */
  chunk: number | null;
  /** Sessions whose full player is on screen right now (the mini player
   * stays hidden for those). */
  hosts: Record<string, number>;
  /** `startAt`: resume a saved point - seconds for a recording, a chunk
   * (section) index for device speech. Only ever called from a user tap.
   * A recording seeks there once it has LOADED, then plays. */
  start: (sessionKey: string, plan: AudioPlan, meta: AudioSessionMeta, startAt?: { type: 'seconds' | 'chunk'; value: number }) => void;
  /** Play / pause; on 'finished' restarts; on 'error' is the explicit retry. */
  toggle: () => void;
  /** Pauses only if playing - used for interruptions (app backgrounded). */
  pause: () => void;
  restart: () => void;
  /** After an error: a fresh engine for the same session, from where it was. */
  retry: () => void;
  /** 0..1 of the recording; ignored when `canSeek` is false or not loaded. */
  seek: (fraction: number) => void;
  setRate: (rate: PlaybackRate) => void;
  /** Stops everything, or only if `sessionKey` is the active session. */
  stop: (sessionKey?: string) => void;
  /** Registers a mounted full player; returns its unregister. */
  registerHost: (sessionKey: string) => () => void;
};

// The one active engine. Module-level so there can never be two.
let activePlan: AudioPlan | null = null;
let player: AudioPlayer | null = null;
let playerSubscription: { remove: () => void } | null = null;
let playerReady = false;
let loadTimer: ReturnType<typeof setTimeout> | null = null;
let chunkIndex = 0;
/**
 * Bumped whenever an engine is released or replaced. Every player callback,
 * speech callback and awaited player call carries the generation it was
 * made for and does NOTHING once it is stale - so a released player (A)
 * can never move the title, progress or status of the next session (B).
 */
let generation = 0;
let listenersInstalled = false;

/** Calls that may throw (a released or broken native player) never escape. */
function attempt(action: () => void): boolean {
  try {
    action();
    return true;
  } catch {
    return false;
  }
}

export const useAudioGuideStore = create<AudioGuideState>((set, get) => {
  const isCurrent = (gen: number) => gen === generation;

  function fail(gen: number, kind: 'recording' | 'speech') {
    if (!isCurrent(gen)) return;
    recordDiagnostic('playback_error', kind);
    set({ status: 'error', errorKind: kind });
  }

  function releaseEngine() {
    // Stale first: whatever the old engine reports while stopping is ignored.
    generation += 1;
    if (loadTimer) clearTimeout(loadTimer);
    loadTimer = null;
    attempt(() => getSpeech()?.stop());
    const old = player;
    const subscription = playerSubscription;
    player = null;
    playerSubscription = null;
    playerReady = false;
    if (old) {
      attempt(() => old.pause());
      attempt(() => subscription?.remove());
      attempt(() => old.remove());
    }
  }

  function speakFrom(index: number) {
    const plan = activePlan;
    const speech = getSpeech();
    if (!plan || plan.kind !== 'tts') return;
    if (!speech) return fail(generation, 'speech');
    if (index >= plan.chunks.length) {
      set({ status: 'finished', progress: 1 });
      return;
    }
    chunkIndex = index;
    // Each utterance is its own generation: stopping / re-speaking makes it stale.
    attempt(() => speech.stop());
    const gen = ++generation;
    set({ status: 'playing', errorKind: null, progress: index / plan.chunks.length, chunk: index });
    const spoken = attempt(() =>
      speech.speak(plan.chunks[index], {
        language: plan.bcp47,
        voice: plan.voiceId ?? undefined,
        rate: get().rate,
        onDone: () => {
          if (isCurrent(gen)) speakFrom(index + 1);
        },
        onError: () => fail(gen, 'speech'),
      }),
    );
    if (!spoken) fail(gen, 'speech');
  }

  /** Seek (once loaded) to the saved point, then play - unless paused meanwhile. */
  async function begin(gen: number, target: AudioPlayer, startSeconds: number) {
    if (startSeconds > 0) {
      // A rejected seek starts from where the player is (0) - never a crash,
      // and the time shown is what the player reports next.
      await target.seekTo(startSeconds).catch(() => undefined);
      if (!isCurrent(gen)) return;
    }
    if (get().status !== 'loading') return; // paused while loading
    if (!attempt(() => target.setPlaybackRate(get().rate)) || !attempt(() => target.play())) return fail(gen, 'recording');
    set({ status: 'playing', elapsed: startSeconds > 0 ? target.currentTime ?? startSeconds : 0 });
  }

  function startRecorded(source: Extract<AudioPlan, { kind: 'recorded' }>['source'], startSeconds = 0) {
    const gen = generation;
    let created: AudioPlayer;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createAudioPlayer } = require('expo-audio') as typeof import('expo-audio');
      created = createAudioPlayer(source, { updateInterval: 250 });
    } catch {
      return fail(gen, 'recording');
    }
    player = created;
    set({ status: 'loading', errorKind: null });
    const onReady = () => {
      if (playerReady || !isCurrent(gen)) return;
      playerReady = true;
      if (loadTimer) clearTimeout(loadTimer);
      loadTimer = null;
      void begin(gen, created, startSeconds);
    };
    playerSubscription = created.addListener('playbackStatusUpdate', (status: AudioStatus) => {
      if (!isCurrent(gen) || player !== created) return;
      if (status.error) return fail(gen, 'recording');
      const duration = status.duration > 0 ? status.duration : null;
      if (!playerReady) {
        if (duration) set({ duration });
        if (status.isLoaded) onReady();
        return;
      }
      const finished = status.didJustFinish;
      // Mirror what the player actually reports on every update, so an
      // audio-session interruption (call, other app) shows as paused, and
      // a momentary `playing: false` while starting/buffering corrects
      // itself on the next update instead of sticking.
      const current = get().status;
      if (current === 'loading') return; // seeking to the resume point
      const nextStatus = finished
        ? 'finished'
        : status.playing
          ? current === 'paused' || current === 'playing'
            ? 'playing'
            : current
          : current === 'playing' && !status.isBuffering
            ? 'paused'
            : current;
      set({
        elapsed: status.currentTime,
        duration,
        progress: finished ? 1 : duration ? Math.min(1, status.currentTime / duration) : 0,
        status: nextStatus,
      });
    });
    loadTimer = setTimeout(() => {
      if (!playerReady) fail(gen, 'recording');
    }, LOAD_TIMEOUT_MS);
    // Already loaded (e.g. a bundled file on some platforms) before the listener existed.
    if ((created as { isLoaded?: boolean }).isLoaded) onReady();
  }

  function startEngine(startAt?: { type: 'seconds' | 'chunk'; value: number }) {
    const plan = activePlan;
    if (!plan) return;
    if (plan.kind === 'tts') {
      // A saved section that no longer exists (text changed) starts at 0.
      const from = startAt?.type === 'chunk' && startAt.value > 0 && startAt.value < plan.chunks.length ? Math.floor(startAt.value) : 0;
      speakFrom(from);
    } else if (plan.kind === 'recorded') startRecorded(plan.source, startAt?.type === 'seconds' ? Math.max(0, startAt.value) : 0);
  }

  function installGlobalListeners() {
    if (listenersInstalled) return;
    listenersInstalled = true;
    // No background playback: going to the background PAUSES (keeping the
    // position) - coming back never restarts from zero and never resumes on
    // its own; the listener taps play when ready.
    AppState.addEventListener('change', (state) => {
      if (state === 'background') get().pause();
    });
    // A different language means different narration - never keep reading
    // the previous one.
    i18n.on('languageChanged', () => get().stop());
  }

  return {
    sessionKey: null,
    meta: null,
    status: 'idle',
    errorKind: null,
    progress: 0,
    elapsed: null,
    duration: null,
    rate: 1,
    canSeek: false,
    chunk: null,
    hosts: {},

    start: (sessionKey, plan, meta, startAt) => {
      installGlobalListeners();
      // One narration at a time: whatever was playing is released first.
      releaseEngine();
      activePlan = plan;
      set({ sessionKey, meta, status: 'idle', errorKind: null, progress: 0, elapsed: null, duration: null, canSeek: plan.kind === 'recorded', chunk: null });
      startEngine(startAt);
    },

    pause: () => {
      const { status } = get();
      if (status === 'playing') get().toggle();
      // Backgrounded while a recording loads: it must not start playing on its own.
      else if (status === 'loading') set({ status: 'paused' });
    },

    seek: (fraction) => {
      const { duration, canSeek, elapsed, progress } = get();
      const target = player;
      if (!canSeek || !target || !playerReady || !duration) return;
      const gen = generation;
      const clamped = Math.min(1, Math.max(0, fraction));
      target.seekTo(clamped * duration).catch(() => {
        // Didn't move: show where the player really is.
        if (isCurrent(gen)) set({ elapsed, progress });
      });
      set({ elapsed: clamped * duration, progress: clamped, status: get().status === 'finished' ? 'paused' : get().status });
    },

    registerHost: (sessionKey) => {
      set((state) => ({ hosts: { ...state.hosts, [sessionKey]: (state.hosts[sessionKey] ?? 0) + 1 } }));
      return () =>
        set((state) => {
          const count = (state.hosts[sessionKey] ?? 1) - 1;
          const hosts = { ...state.hosts };
          if (count > 0) hosts[sessionKey] = count;
          else delete hosts[sessionKey];
          return { hosts };
        });
    },

    toggle: () => {
      const { status } = get();
      if (!activePlan) return;
      if (status === 'playing') {
        if (activePlan.kind === 'tts') {
          generation += 1; // the current utterance's callbacks are now stale
          attempt(() => getSpeech()?.stop());
        } else if (player && !attempt(() => player!.pause())) return fail(generation, 'recording');
        set({ status: 'paused' });
      } else if (status === 'loading') {
        set({ status: 'paused' });
      } else if (status === 'paused') {
        if (activePlan.kind === 'tts') speakFrom(chunkIndex);
        else if (!playerReady) set({ status: 'loading' }); // still loading: begin() plays once ready
        else if (player && attempt(() => player!.play())) set({ status: 'playing' });
        else fail(generation, 'recording');
      } else if (status === 'finished') {
        get().restart();
      } else if (status === 'error') {
        get().retry();
      }
    },

    restart: () => {
      if (!activePlan) return;
      if (activePlan.kind === 'tts') speakFrom(0);
      else if (player && playerReady) {
        const gen = generation;
        const target = player;
        void target.seekTo(0).catch(() => undefined);
        if (!attempt(() => target.play())) return fail(gen, 'recording');
        set({ status: 'playing', progress: 0, elapsed: 0 });
      } else get().retry();
    },

    retry: () => {
      const { sessionKey, elapsed, canSeek } = get();
      if (!activePlan || !sessionKey) return;
      // A fresh engine: the broken player is released, never reused.
      const from = activePlan.kind === 'tts' ? { type: 'chunk' as const, value: chunkIndex } : { type: 'seconds' as const, value: canSeek ? (elapsed ?? 0) : 0 };
      releaseEngine();
      set({ status: 'idle', errorKind: null });
      startEngine(from);
    },

    setRate: (rate) => {
      set({ rate });
      if (activePlan?.kind === 'recorded') {
        if (player && playerReady) attempt(() => player!.setPlaybackRate(rate));
      }
      // TTS rate applies per utterance - re-speak the current sentence.
      else if (activePlan?.kind === 'tts' && get().status === 'playing') speakFrom(chunkIndex);
    },

    stop: (sessionKey) => {
      if (sessionKey && get().sessionKey !== sessionKey) return;
      releaseEngine();
      activePlan = null;
      set({ sessionKey: null, meta: null, status: 'idle', errorKind: null, progress: 0, elapsed: null, duration: null, canSeek: false, chunk: null });
    },
  };
});
