import type { AudioPlayer } from 'expo-audio';
import { create } from 'zustand';

import { useAudioGuideStore } from '@/services/audioGuide/useAudioGuideStore';

import { narrationAudio } from './narrationAudio';

/**
 * One curator narration at a time, never over other app audio:
 * - playing a narration stops the audio guide, komuz music and speech;
 * - the audio guide or komuz starting stops the narration;
 * - leaving the exhibition or switching account calls stopNarration().
 * The URI is looked up for the CURRENT owner only.
 */
type State = { playingId: string | null; owner: string | null };
export const useNarrationPlayer = create<State>(() => ({ playingId: null, owner: null }));

let player: AudioPlayer | null = null;
let listening = false;
let token = 0;

function release() {
  try {
    player?.pause();
    player?.remove();
  } catch {
    // already released
  }
  player = null;
}

export function stopNarration(): void {
  token += 1;
  release();
  if (useNarrationPlayer.getState().playingId) useNarrationPlayer.setState({ playingId: null, owner: null });
}

function listen() {
  if (listening) return;
  listening = true;
  useAudioGuideStore.subscribe((state, previous) => {
    if ((state.status === 'playing' || state.status === 'loading') && state.status !== previous.status) stopNarration();
  });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useKomuzPlayerStore } = require('@/features/culture/komuz/listening/useKomuzPlayerStore') as typeof import('@/features/culture/komuz/listening/useKomuzPlayerStore');
  useKomuzPlayerStore.subscribe((state, previous) => {
    if (state.playing && !previous.playing) stopNarration();
  });
}

/** The app's audio XOR rule (the audio guide, komuz music, speech) - the same one Listen & Repeat uses. Loaded lazily. */
export function stopOtherAppAudio(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('@/features/culture/glossary/practice/practiceAudio') as typeof import('@/features/culture/glossary/practice/practiceAudio')).stopOtherAudio();
}

/** Removes a TEMPORARY recording (web blob URL / native cache file). */
export function deleteTempRecording(uri: string | null): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('@/features/culture/glossary/practice/practiceAudio') as typeof import('@/features/culture/glossary/practice/practiceAudio')).deleteRecording(uri);
}

function start(uri: string, id: string, owner: string | null, mine: number): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createAudioPlayer } = require('expo-audio') as typeof import('expo-audio');
    player = createAudioPlayer(uri);
    player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish && mine === token) stopNarration();
    });
    player.play();
  } catch {
    release();
    return false;
  }
  useNarrationPlayer.setState({ playingId: id, owner });
  return true;
}

/** Other audio off first (the guide, komuz, speech), then this owner's recording. Resolves false when it can't play. */
export async function playNarration(owner: string, audioId: string, stopOthers: () => void): Promise<boolean> {
  listen();
  stopNarration();
  const mine = ++token;
  stopOthers();
  const uri = await narrationAudio()
    .uri(owner, audioId)
    .catch(() => null);
  if (!uri || mine !== token) return false;
  return start(uri, audioId, owner, mine);
}

/** The curator listening to a NOT YET SAVED recording (id 'preview'). */
export function previewRecording(tempUri: string, stopOthers: () => void): boolean {
  listen();
  stopNarration();
  const mine = ++token;
  stopOthers();
  return start(tempUri, PREVIEW_ID, null, mine);
}
export const PREVIEW_ID = 'preview';
