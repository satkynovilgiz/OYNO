import { Platform } from 'react-native';

import { resolveAudioPlan, type VoiceInfo } from '@/services/audioGuide/narration';
import type { AudioSource } from 'expo-audio';

/**
 * Glossary Listen & Repeat - hear the EXISTING canonical Kyrgyz term,
 * record yourself, listen back, try again. No scoring, no speech
 * recognition, no AI, no upload: the person compares by ear.
 */

export const MAX_RECORDING_MS = 10_000;

export type ReferenceAudio = { kind: 'recorded'; source: AudioSource } | { kind: 'tts'; voiceId: string | null; language: string } | { kind: 'unavailable' };

/**
 * Priority: a real recorded pronunciation -> a device KYRGYZ voice ->
 * unavailable. The term is Kyrgyz whatever the app language is, so the
 * plan is resolved for 'kg': a Russian/English voice never stands in.
 */
export function referenceAudio(term: string, recorded: AudioSource | null, ttsAvailable: boolean, voices: VoiceInfo[]): ReferenceAudio {
  const plan = resolveAudioPlan({ appLanguage: 'kg', narration: { lang: 'kg', text: term }, recorded, ttsAvailable, voices });
  if (plan.kind === 'recorded') return { kind: 'recorded', source: plan.source };
  if (plan.kind === 'tts') return { kind: 'tts', voiceId: plan.voiceId, language: plan.bcp47 };
  return { kind: 'unavailable' };
}

/**
 * Recording in THIS build. The installed native apps were built WITHOUT a
 * microphone permission (app.json: expo-audio microphonePermission false,
 * recordAudioAndroid false) - asking for the mic there would crash on iOS.
 * An over-the-air update can't add a permission, and runtimeVersion is
 * 'sdkVersion', so flipping this must ship TOGETHER with: the app.json
 * permission text, a runtimeVersion bump, and a new native build.
 */
export const MICROPHONE_NATIVE_BUILD_READY = false;

export type RecordingSupport = 'available' | 'needs_app_update' | 'unsupported';

export function recordingSupport(platform: string = Platform.OS, hasGetUserMedia = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia): RecordingSupport {
  if (platform === 'web') return hasGetUserMedia ? 'available' : 'unsupported';
  return MICROPHONE_NATIVE_BUILD_READY ? 'available' : 'needs_app_update';
}

export type PracticePhase = 'ready' | 'recording' | 'recorded';

/** "Practice again" uses the EXISTING study model (needsReview); "Easy" changes nothing. */
export type SelfCheck = 'easy' | 'practice_again';

/** Analytics may only ever carry the glossary entry id. */
export function practiceEventProps(glossaryEntryId: string): { glossary_entry_id: string } {
  return { glossary_entry_id: glossaryEntryId };
}
