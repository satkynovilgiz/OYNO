import type { AudioSource } from 'expo-audio';

import type { SupportedLanguage } from '@/i18n';

/**
 * Recorded narration, keyed by content and app language - the override
 * for device text-to-speech. Keys use the same `<contentType>:<id>` shape
 * as favorites (`culture_item:boz-uy-tunduk`, `culture_material:komuz-discovery`,
 * `region:son-kol`). Daily OYNO narrates a culture item, so it reuses that
 * item's `culture_item:` entry.
 *
 * To add a recording, drop the file in assets/audio/guide/ and add e.g.
 *   'culture_item:boz-uy-overview': { kg: require('@assets/audio/guide/boz_uy_kg.mp3') },
 * - every Listen control picks it up; no screen changes needed. A recording
 * exists per APP language, so a Russian narration of a Kyrgyz-authored item
 * is valid here even though the item's text itself is Kyrgyz-only.
 */
export const contentAudio: Record<string, Partial<Record<SupportedLanguage, AudioSource>>> = {};

export function recordedAudioFor(contentKey: string, language: SupportedLanguage): AudioSource | null {
  return contentAudio[contentKey]?.[language] ?? null;
}
