import { Platform } from 'react-native';

import { useKomuzPlayerStore } from '@/features/culture/komuz/listening/useKomuzPlayerStore';
import { isSpeechEngineAvailable, useAudioGuideStore } from '@/services/audioGuide/useAudioGuideStore';

/**
 * Side effects for Listen & Repeat. Everything stays on the device: no
 * network call, no upload, no analytics payload.
 */

/** Audio XOR rule: nothing else plays while the reference or the mic is in use. */
export function stopOtherAudio(): void {
  useAudioGuideStore.getState().stop();
  useKomuzPlayerStore.getState().stop();
  stopTerm();
}

export function speakTerm(term: string, voice: { voiceId: string | null; language: string }, onDone?: () => void): void {
  if (!isSpeechEngineAvailable()) return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Speech = require('expo-speech') as typeof import('expo-speech');
  Speech.stop();
  Speech.speak(term, { language: voice.language, voice: voice.voiceId ?? undefined, rate: 0.85, onDone, onStopped: onDone, onError: onDone });
}

export function stopTerm(): void {
  if (!isSpeechEngineAvailable()) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('expo-speech') as typeof import('expo-speech')).stop();
  } catch {
    // nothing playing
  }
}

/**
 * Removes a temporary practice recording: a blob URL on web, the recorder's
 * cache file on native. Only the URI this screen recorded is ever touched.
 */
export function deleteRecording(uri: string | null): void {
  if (!uri) return;
  try {
    if (Platform.OS === 'web' || uri.startsWith('blob:')) {
      if (typeof URL !== 'undefined' && uri.startsWith('blob:')) URL.revokeObjectURL(uri);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { File } = require('expo-file-system') as typeof import('expo-file-system');
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Best effort - the OS also clears the cache folder.
  }
}
