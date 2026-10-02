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

export type AudioGuideStatus = 'idle' | 'playing' | 'paused' | 'finished' | 'error';
export type PlaybackRate = 1 | 1.25 | 1.5;
export const PLAYBACK_RATES: PlaybackRate[] = [1, 1.25, 1.5];

/** What the mini player needs to show and reopen the narration. */
export type AudioSessionMeta = { title: string; route: string | null };

type AudioGuideState = {
  sessionKey: string | null;
  meta: AudioSessionMeta | null;
  status: AudioGuideStatus;
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
   * (section) index for device speech. Only ever called from a user tap. */
  start: (sessionKey: string, plan: AudioPlan, meta: AudioSessionMeta, startAt?: { type: 'seconds' | 'chunk'; value: number }) => void;
  toggle: () => void;
  /** Pauses only if playing - used for interruptions (app backgrounded). */
  pause: () => void;
  restart: () => void;
  /** 0..1 of the recording; ignored when `canSeek` is false. */
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
let chunkIndex = 0;
/** Bumped on every stop/pause so late TTS callbacks from a stopped
 * utterance are ignored. */
let ttsToken = 0;
let listenersInstalled = false;

export const useAudioGuideStore = create<AudioGuideState>((set, get) => {
  function releaseEngine() {
    ttsToken += 1;
    getSpeech()?.stop();
    if (player) {
      try {
        player.pause();
        playerSubscription?.remove();
        player.remove();
      } catch {
        // Already released - nothing to clean up.
      }
    }
    player = null;
    playerSubscription = null;
  }

  function speakFrom(index: number) {
    const plan = activePlan;
    const speech = getSpeech();
    if (!plan || plan.kind !== 'tts' || !speech) return;
    if (index >= plan.chunks.length) {
      set({ status: 'finished', progress: 1 });
      return;
    }
    chunkIndex = index;
    const token = ++ttsToken;
    set({ status: 'playing', progress: index / plan.chunks.length, chunk: index });
    speech.speak(plan.chunks[index], {
      language: plan.bcp47,
      voice: plan.voiceId ?? undefined,
      rate: get().rate,
      onDone: () => {
        if (token === ttsToken) speakFrom(index + 1);
      },
      onError: () => {
        if (token === ttsToken) set({ status: 'error' });
      },
    });
  }

  function startRecorded(source: Extract<AudioPlan, { kind: 'recorded' }>['source'], startSeconds = 0) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createAudioPlayer } = require('expo-audio') as typeof import('expo-audio');
      player = createAudioPlayer(source, { updateInterval: 250 });
      playerSubscription = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
        if (status.error) {
          set({ status: 'error' });
          return;
        }
        const duration = status.duration > 0 ? status.duration : null;
        const finished = status.didJustFinish;
        // Mirror what the player actually reports on every update, so an
        // audio-session interruption (call, other app) shows as paused, and
        // a momentary `playing: false` while starting/buffering corrects
        // itself on the next update instead of sticking.
        const current = get().status;
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
      player.setPlaybackRate(get().rate);
      if (startSeconds > 0) void player.seekTo(startSeconds);
      player.play();
      set({ status: 'playing' });
    } catch {
      set({ status: 'error' });
    }
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
      set({ sessionKey, meta, status: 'idle', progress: 0, elapsed: null, duration: null, canSeek: plan.kind === 'recorded', chunk: null });
      if (plan.kind === 'tts') {
        // A saved section that no longer exists (text changed) starts at 0.
        const from = startAt?.type === 'chunk' && startAt.value > 0 && startAt.value < plan.chunks.length ? Math.floor(startAt.value) : 0;
        speakFrom(from);
      } else if (plan.kind === 'recorded') startRecorded(plan.source, startAt?.type === 'seconds' ? Math.max(0, startAt.value) : 0);
    },

    pause: () => {
      if (get().status === 'playing') get().toggle();
    },

    seek: (fraction) => {
      const { duration, canSeek } = get();
      if (!canSeek || !player || !duration) return;
      const clamped = Math.min(1, Math.max(0, fraction));
      void player.seekTo(clamped * duration);
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
          ttsToken += 1;
          getSpeech()?.stop();
        } else player?.pause();
        set({ status: 'paused' });
      } else if (status === 'paused') {
        if (activePlan.kind === 'tts') speakFrom(chunkIndex);
        else {
          player?.play();
          set({ status: 'playing' });
        }
      } else if (status === 'finished' || status === 'error') {
        get().restart();
      }
    },

    restart: () => {
      if (!activePlan) return;
      if (activePlan.kind === 'tts') {
        ttsToken += 1;
        getSpeech()?.stop();
        speakFrom(0);
      } else if (player) {
        void player.seekTo(0);
        player.play();
        set({ status: 'playing', progress: 0 });
      }
    },

    setRate: (rate) => {
      set({ rate });
      if (activePlan?.kind === 'recorded') player?.setPlaybackRate(rate);
      // TTS rate applies per utterance - re-speak the current sentence.
      else if (activePlan?.kind === 'tts' && get().status === 'playing') {
        ttsToken += 1;
        getSpeech()?.stop();
        speakFrom(chunkIndex);
      }
    },

    stop: (sessionKey) => {
      if (sessionKey && get().sessionKey !== sessionKey) return;
      releaseEngine();
      activePlan = null;
      set({ sessionKey: null, meta: null, status: 'idle', progress: 0, elapsed: null, duration: null, canSeek: false, chunk: null });
    },
  };
});
