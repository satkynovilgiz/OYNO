/**
 * Listening History + Audio Bookmarks - pure rules over the two EXISTING
 * audio experiences (Audio Guide narration, Komuz tracks). No player, no
 * transcript: only references, a public title, and a position stored only
 * where it is real - seconds for recordings/tracks, a section (chunk)
 * index for device speech (never fake milliseconds).
 */

export type ListeningSource = 'guide' | 'komuz';
export type PositionType = 'seconds' | 'chunk';

export type ListeningRecord = {
  key: string;
  sourceType: ListeningSource;
  /** Guide: content key (e.g. `culture_item:boz-uy-tunduk`); Komuz: track id. */
  sourceId: string;
  title: string;
  route: string;
  positionType: PositionType | null;
  position: number | null;
  lastListenedAt: string;
  /** Only when the player itself reported the end. */
  completed: boolean;
};

export type AudioBookmark = {
  id: string;
  sourceType: ListeningSource;
  sourceId: string;
  title: string;
  route: string;
  positionType: PositionType;
  position: number;
  createdAt: string;
};

export type ListeningData = { history: Record<string, ListeningRecord>; bookmarks: Record<string, AudioBookmark> };
export const EMPTY_LISTENING: ListeningData = { history: {}, bookmarks: {} };
export const HISTORY_LIMIT = 12;

export function listeningKey(sourceType: ListeningSource, sourceId: string): string {
  return `${sourceType}:${sourceId}`;
}

/** Upsert the latest state of one listening source; history stays capped
 * (oldest dropped). A finished item stays finished until played again. */
export function recordListening(data: ListeningData, input: Omit<ListeningRecord, 'key' | 'lastListenedAt'> & { at: string }): ListeningData {
  const key = listeningKey(input.sourceType, input.sourceId);
  const record: ListeningRecord = { key, sourceType: input.sourceType, sourceId: input.sourceId, title: input.title, route: input.route, positionType: input.positionType, position: input.position, lastListenedAt: input.at, completed: input.completed };
  const history = { ...data.history, [key]: record };
  const keys = Object.values(history).sort((a, b) => b.lastListenedAt.localeCompare(a.lastListenedAt));
  for (const stale of keys.slice(HISTORY_LIMIT)) delete history[stale.key];
  return { ...data, history };
}

/** Newest first. */
export function recentListening(data: ListeningData): ListeningRecord[] {
  return Object.values(data.history).sort((a, b) => b.lastListenedAt.localeCompare(a.lastListenedAt) || a.key.localeCompare(b.key));
}

/** "Continue listening": the most recent unfinished item that has a real
 * saved position (one item only). */
export function continueListening(data: ListeningData, exists: (record: ListeningRecord) => boolean): ListeningRecord | null {
  return recentListening(data).find((record) => !record.completed && record.position !== null && record.position > 0 && exists(record)) ?? null;
}

export function addBookmark(data: ListeningData, input: Omit<AudioBookmark, 'id' | 'createdAt'>, now = new Date()): { data: ListeningData; bookmark: AudioBookmark } {
  const position = input.positionType === 'seconds' ? Math.floor(input.position) : Math.max(0, Math.floor(input.position));
  const id = `${listeningKey(input.sourceType, input.sourceId)}@${input.positionType}:${position}`;
  const existing = data.bookmarks[id];
  if (existing) return { data, bookmark: existing };
  const bookmark: AudioBookmark = { ...input, position, id, createdAt: now.toISOString() };
  return { data: { ...data, bookmarks: { ...data.bookmarks, [id]: bookmark } }, bookmark };
}

export function removeBookmark(data: ListeningData, id: string): ListeningData {
  if (!data.bookmarks[id]) return data;
  const bookmarks = { ...data.bookmarks };
  delete bookmarks[id];
  return { ...data, bookmarks };
}

export function sortedBookmarks(data: ListeningData): AudioBookmark[] {
  return Object.values(data.bookmarks).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}

/** Guest -> account: newest record per source wins; bookmarks unioned. */
export function mergeListening(into: ListeningData, from: ListeningData): ListeningData {
  let merged: ListeningData = { history: { ...into.history }, bookmarks: { ...into.bookmarks, ...from.bookmarks } };
  for (const record of Object.values(from.history)) {
    const existing = merged.history[record.key];
    if (!existing || record.lastListenedAt > existing.lastListenedAt) merged = recordListening(merged, { ...record, at: record.lastListenedAt });
  }
  return merged;
}

/** The resume link for a saved point - opens the content; the audio only
 * starts when the listener taps Resume there (never automatically). */
export function resumeRoute(item: { sourceType: ListeningSource; sourceId: string; route: string; positionType: PositionType | null; position: number | null }): string {
  if (item.sourceType === 'komuz') {
    const at = item.positionType === 'seconds' && item.position ? `&at=${Math.floor(item.position)}` : '';
    return `/culture/komuz/listen?resumeTrack=${encodeURIComponent(item.sourceId)}${at}`;
  }
  if (item.positionType === null || item.position === null) return item.route;
  const separator = item.route.includes('?') ? '&' : '?';
  return `${item.route}${separator}resumeAudio=${encodeURIComponent(`${item.sourceId}|${item.positionType}|${Math.floor(item.position)}`)}`;
}

/** Parses the `resumeAudio` param (untrusted): content key, type, value. */
export function parseResumeParam(value: unknown): { contentKey: string; type: PositionType; value: number } | null {
  if (typeof value !== 'string') return null;
  const [contentKey, type, raw] = decodeURIComponent(value).split('|');
  const number = Number(raw);
  if (!contentKey || (type !== 'seconds' && type !== 'chunk') || !Number.isFinite(number) || number < 0 || number > 36000) return null;
  return { contentKey, type, value: Math.floor(number) };
}
