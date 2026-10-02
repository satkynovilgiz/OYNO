/**
 * Komuz Listening Room - pure queue/metadata rules. Tracks are the
 * EXISTING bundled komuzTracks; their titles/performers are authored
 * metadata and are never rewritten (an unconfirmed "Комуз күүсү №4" stays
 * exactly that, labelled unconfirmed).
 */

/** Next index in the queue, or null at the end (no wrap - no Repeat mode). */
export function nextIndex(length: number, index: number): number | null {
  return index + 1 < length ? index + 1 : null;
}

/** Previous index, or null at the start (no wrap). */
export function previousIndex(index: number): number | null {
  return index - 1 >= 0 ? index - 1 : null;
}

export type TrackFilter = 'all' | 'favorites';

/** The visible queue: every track, or only favorites, in the authored order. */
export function filterTracks<T extends { id: string }>(tracks: readonly T[], filter: TrackFilter, favorites: readonly string[]): T[] {
  return filter === 'favorites' ? tracks.filter((track) => favorites.includes(track.id)) : [...tracks];
}

/** Favorites filter only when there is something in it. */
export function showFavoritesFilter(favorites: readonly string[], trackIds: readonly string[]): boolean {
  return favorites.some((id) => trackIds.includes(id));
}

export function toggleId(list: readonly string[], id: string): string[] {
  return list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];
}

export const MAX_RECENT = 5;
/** Playback counts as "listened" only after this much real playback - not
 * when a screen opens or a track is merely selected. */
export const MEANINGFUL_SECONDS = 5;

export function addRecent(list: readonly string[], id: string): string[] {
  return [id, ...list.filter((entry) => entry !== id)].slice(0, MAX_RECENT);
}

/** "2:14" for the readout. */
export function clockTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** "2 minutes 14 seconds" - only for a REAL duration reported by the
 * player; there is no duration text without one (never fabricated). */
export function spokenTime(seconds: number, t: Translate): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  const parts = [];
  if (minutes > 0) parts.push(t('komuzRoom.minutes', { count: minutes }));
  parts.push(t('komuzRoom.seconds', { count: rest }));
  return parts.join(' ');
}

/** A real, playable duration (> 0 and finite) or null. */
export function realDuration(duration: number | null | undefined): number | null {
  return typeof duration === 'number' && Number.isFinite(duration) && duration > 0 ? duration : null;
}
