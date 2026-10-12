/**
 * Listening Compare - two recordings, one player, one comparison note.
 *
 * - The existing single komuz player plays ONE recording at a time;
 *   switching is explicit and loads the other (which stops the first).
 * - Each recording's position is remembered separately (memory) and only
 *   restored through the player's real seek once it reports a duration -
 *   never guessed, never aligned between recordings.
 * - Moments are saved in the Listening Notebook; the comparison keeps their
 *   ids plus a snapshot of the seconds, so it survives a deleted moment or
 *   a missing recording. The note is the listener's own observation.
 */
export const COMPARE_NOTE_MAX = 800;
export const MAX_COMPARISONS = 100;
export type Side = 'a' | 'b';
export type SavedMoment = { momentId: string; seconds: number };
export type Comparison = {
  id: string;
  a: { trackId: string; title: string };
  b: { trackId: string; title: string };
  moments: Partial<Record<Side, SavedMoment>>;
  note: string;
  createdAt: string;
  updatedAt: string;
};
export type Comparisons = Record<string, Comparison>;

const TRACK_ID = /^[A-Za-z0-9_-]{1,80}$/;
const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/[<>{}]/g, '').slice(0, max) : '');
export const otherSide = (side: Side): Side => (side === 'a' ? 'b' : 'a');

/** Two different, available recordings. */
export function canStart(a: string | null, b: string | null, available: (id: string) => boolean): boolean {
  return !!a && !!b && a !== b && available(a) && available(b);
}

export function newComparison(id: string, a: { trackId: string; title: string }, b: { trackId: string; title: string }, now: string): Comparison {
  return { id, a: { trackId: a.trackId, title: clean(a.title, 160) }, b: { trackId: b.trackId, title: clean(b.title, 160) }, moments: {}, note: '', createdAt: now, updatedAt: now };
}

export function setMoment(comparison: Comparison, side: Side, moment: SavedMoment, now: string): Comparison {
  return { ...comparison, moments: { ...comparison.moments, [side]: { momentId: moment.momentId, seconds: Math.max(0, Math.round(moment.seconds * 10) / 10) } }, updatedAt: now };
}
export function setNote(comparison: Comparison, note: string, now: string): Comparison {
  const next = clean(note, COMPARE_NOTE_MAX);
  return next === comparison.note ? comparison : { ...comparison, note: next, updatedAt: now };
}

/* ---------- playback positions per recording (memory) ---------- */
const positions = new Map<string, number>();
const posKey = (owner: string, comparisonId: string, side: Side) => `${owner}::${comparisonId}::${side}`;
export const rememberPosition = (owner: string, comparisonId: string, side: Side, seconds: number) => {
  if (Number.isFinite(seconds) && seconds >= 0) positions.set(posKey(owner, comparisonId, side), seconds);
};
export const rememberedPosition = (owner: string, comparisonId: string, side: Side): number => positions.get(posKey(owner, comparisonId, side)) ?? 0;

export type PlayerView = { currentTrackId: string | null; position: number; duration: number | null };

/**
 * Switching to `to`: what to remember for the side being left, and how to
 * start `to`. The previous recording is stopped by the player itself
 * (one engine). The remembered position is restored with the player's
 * seek once it knows the duration (playFrom).
 */
export function switchPlan(comparison: Comparison, from: Side | null, to: Side, player: PlayerView, remembered: number, available: (id: string) => boolean): { leave: { side: Side; seconds: number } | null; start: { kind: 'playFrom'; trackId: string; seconds: number } | { kind: 'missing' } | { kind: 'already' } } {
  const target = comparison[to].trackId;
  const leaving = from && player.currentTrackId === comparison[from].trackId && from !== to ? { side: from, seconds: player.position } : null;
  if (!available(target)) return { leave: leaving, start: { kind: 'missing' } };
  if (player.currentTrackId === target) return { leave: leaving, start: { kind: 'already' } };
  return { leave: leaving, start: { kind: 'playFrom', trackId: target, seconds: remembered } };
}

/** Which side the player is on now (null = neither of this comparison's recordings). */
export function activeSide(comparison: Comparison, currentTrackId: string | null): Side | null {
  if (currentTrackId === comparison.a.trackId) return 'a';
  if (currentTrackId === comparison.b.trackId) return 'b';
  return null;
}

export function normalizeComparisons(raw: unknown): Comparisons {
  const out: Comparisons = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, value] of Object.entries(raw as Record<string, Partial<Comparison>>)) {
    if (!value || value.id !== id || !value.a || !value.b || !TRACK_ID.test(String(value.a.trackId)) || !TRACK_ID.test(String(value.b.trackId))) continue;
    const moments: Comparison['moments'] = {};
    for (const side of ['a', 'b'] as const) {
      const m = value.moments?.[side];
      if (m && typeof m.momentId === 'string' && typeof m.seconds === 'number' && Number.isFinite(m.seconds)) moments[side] = { momentId: m.momentId, seconds: Math.max(0, m.seconds) };
    }
    out[id] = { id, a: { trackId: value.a.trackId, title: clean(value.a.title, 160) }, b: { trackId: value.b.trackId, title: clean(value.b.title, 160) }, moments, note: clean(value.note, COMPARE_NOTE_MAX), createdAt: String(value.createdAt ?? ''), updatedAt: String(value.updatedAt ?? '') };
  }
  return out;
}

export const newComparisonId = () => `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export const compareRoute = (id: string) => `/culture/komuz/compare/${encodeURIComponent(id)}`;

/* ---------- unsaved note drafts (memory, per owner) ---------- */
const drafts = new Map<string, string>();
export const noteDraft = (owner: string, id: string) => drafts.get(`${owner}::${id}`);
export const setNoteDraft = (owner: string, id: string, text: string | null) => (text === null ? drafts.delete(`${owner}::${id}`) : drafts.set(`${owner}::${id}`, text));
export const clearNoteDraftIfUnchanged = (owner: string, id: string, sent: string) => {
  if (drafts.get(`${owner}::${id}`) === sent) drafts.delete(`${owner}::${id}`);
};
