import type { AudioSource } from 'expo-audio';

import type { SupportedLanguage } from '@/i18n';

/** Visible content to narrate, and the language it is actually written in
 * (culture/explore text is Kyrgyz-authored; only some summaries exist in
 * ru/en). Never includes buttons, labels or metadata. */
export type Narration = {
  lang: SupportedLanguage;
  text: string;
};

export type VoiceInfo = { identifier: string; language: string };

export type UnavailableReason = 'noContentInLanguage' | 'noVoice' | 'noEngine' | 'empty';

export type AudioPlan =
  | { kind: 'recorded'; source: AudioSource }
  | { kind: 'tts'; bcp47: string; voiceId: string | null; chunks: string[] }
  | { kind: 'unavailable'; reason: UnavailableReason };

const BCP47_PREFIX: Record<SupportedLanguage, string> = { kg: 'ky', ru: 'ru', en: 'en' };
const BCP47_DEFAULT: Record<SupportedLanguage, string> = { kg: 'ky-KG', ru: 'ru-RU', en: 'en-US' };

/** A device voice genuinely for this language - "ky"/"ky-KG" for Kyrgyz,
 * never a Russian or Turkish voice standing in for it. */
export function voiceMatchesLanguage(voiceLanguage: string, language: SupportedLanguage): boolean {
  const prefix = voiceLanguage.toLowerCase().split(/[-_]/)[0];
  return prefix === BCP47_PREFIX[language];
}

/** Sentence-sized pieces, so pause/resume and progress work the same on
 * every platform (Android TTS has no native pause). */
export function splitIntoChunks(text: string, maxLength = 220): string[] {
  const sentences = text
    .replace(/\s+/g, ' ')
    .trim()
    .match(/[^.!?…]+[.!?…]+["»”)]*\s*|[^.!?…]+$/g);
  if (!sentences) return [];
  const chunks: string[] = [];
  let current = '';
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (current && (current + ' ' + sentence).length > maxLength) {
      chunks.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Rough listening time for the Listen label (~150 words/min at 1x). */
export function estimateListenMinutes(text: string): number {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return Math.max(1, Math.round(words / 150));
}

/**
 * Priority: 1) a recorded file for this content in the APP language;
 * 2) device TTS - only when the content text is actually written in the
 * app language AND the device has a voice for that language; 3) an honest
 * unavailable reason. Kyrgyz text is never read with a Russian/English
 * voice, and a Russian/English user is never read Kyrgyz text.
 */
export function resolveAudioPlan(params: {
  appLanguage: SupportedLanguage;
  narration: Narration | null;
  recorded: AudioSource | null;
  ttsAvailable: boolean;
  voices: VoiceInfo[];
}): AudioPlan {
  const { appLanguage, narration, recorded, ttsAvailable, voices } = params;
  if (recorded) return { kind: 'recorded', source: recorded };
  if (!narration || !narration.text.trim()) return { kind: 'unavailable', reason: 'empty' };
  if (narration.lang !== appLanguage) return { kind: 'unavailable', reason: 'noContentInLanguage' };
  if (!ttsAvailable) return { kind: 'unavailable', reason: 'noEngine' };
  const voice = voices.find((candidate) => voiceMatchesLanguage(candidate.language, appLanguage));
  if (!voice) return { kind: 'unavailable', reason: 'noVoice' };
  return { kind: 'tts', bcp47: voice.language || BCP47_DEFAULT[appLanguage], voiceId: voice.identifier, chunks: splitIntoChunks(narration.text) };
}

/** Joins visible content pieces into one narration text, skipping empties. */
export function joinNarration(parts: (string | null | undefined)[]): string {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .map((part) => (/[.!?…:]$/.test(part!) ? part! : `${part}.`))
    .join(' ');
}
