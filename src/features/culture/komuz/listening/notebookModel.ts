/**
 * Listening Notebook - moments in a komuz recording with a personal note.
 * A moment keeps the STABLE track id (komuzTracks), the playback position
 * the player reported when "Save this moment" was tapped, the track title
 * at that time, and the listener's own words. Nothing is said about the
 * music: notes are personal observations, labelled as such.
 */
export const NOTE_MAX = 400;
export const MAX_MOMENTS = 300;

export type Moment = { id: string; trackId: string; seconds: number; titleSnapshot: string; note: string; createdAt: string; updatedAt: string };
export type Notebook = Record<string, Moment>;

const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/[<>{}]/g, '').slice(0, max) : '');
const TRACK_ID = /^[A-Za-z0-9_-]{1,80}$/;
const round = (seconds: number) => Math.round(seconds * 10) / 10;

/**
 * The moment at the player's CURRENT position (never a guess): clamped to
 * 0..duration when the duration is known.
 */
export function captureMoment(notebook: Notebook, input: { trackId: string; title: string; position: number; duration: number | null }, now = new Date()): { notebook: Notebook; moment: Moment | null } {
  if (!TRACK_ID.test(input.trackId) || !Number.isFinite(input.position) || Object.keys(notebook).length >= MAX_MOMENTS) return { notebook, moment: null };
  const upper = input.duration !== null && Number.isFinite(input.duration) ? input.duration : Number.POSITIVE_INFINITY;
  const seconds = round(Math.min(upper, Math.max(0, input.position)));
  const at = now.toISOString();
  const moment: Moment = { id: `m${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`, trackId: input.trackId, seconds, titleSnapshot: clean(input.title, 160), note: '', createdAt: at, updatedAt: at };
  return { notebook: { ...notebook, [moment.id]: moment }, moment };
}
export function setMomentNote(notebook: Notebook, id: string, note: string, now = new Date()): Notebook {
  const moment = notebook[id];
  if (!moment) return notebook;
  return { ...notebook, [id]: { ...moment, note: clean(note, NOTE_MAX), updatedAt: now.toISOString() } };
}
export function removeMoment(notebook: Notebook, id: string): Notebook {
  if (!notebook[id]) return notebook;
  const next = { ...notebook };
  delete next[id];
  return next;
}

/** Moments by track, each in timestamp order; tracks in the given order, then unknown (missing) ones. */
export function groupedMoments(notebook: Notebook, trackOrder: readonly string[]): { trackId: string; moments: Moment[] }[] {
  const byTrack = new Map<string, Moment[]>();
  for (const moment of Object.values(notebook)) byTrack.set(moment.trackId, [...(byTrack.get(moment.trackId) ?? []), moment]);
  const ids = [...trackOrder.filter((id) => byTrack.has(id)), ...[...byTrack.keys()].filter((id) => !trackOrder.includes(id)).sort()];
  return ids.map((trackId) => ({ trackId, moments: (byTrack.get(trackId) ?? []).sort((a, b) => a.seconds - b.seconds || a.createdAt.localeCompare(b.createdAt)) }));
}

export type SeekPlan =
  /** The track is playing in the existing player with a known duration: seek there (clamped). */
  | { kind: 'seek'; seconds: number }
  /** Another (available) track: start it at this point (the player clamps once it knows the duration). */
  | { kind: 'playFrom'; seconds: number }
  /** The current track doesn't report a seekable duration: explain; the note is kept. */
  | { kind: 'notSeekable' }
  | { kind: 'missing' };

export function seekPlan(moment: Moment, player: { currentTrackId: string | null; duration: number | null }, trackExists: boolean): SeekPlan {
  if (!trackExists) return { kind: 'missing' };
  if (player.currentTrackId !== moment.trackId) return { kind: 'playFrom', seconds: Math.max(0, moment.seconds) };
  if (player.duration === null) return { kind: 'notSeekable' };
  return { kind: 'seek', seconds: Math.min(player.duration, Math.max(0, moment.seconds)) };
}

export function normalizeNotebook(raw: unknown): Notebook {
  const out: Notebook = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const value of Object.values(raw as Record<string, Partial<Moment>>)) {
    if (!value || typeof value.id !== 'string' || !/^m[a-z0-9]{2,40}$/.test(value.id) || typeof value.trackId !== 'string' || !TRACK_ID.test(value.trackId) || typeof value.seconds !== 'number' || !Number.isFinite(value.seconds)) continue;
    out[value.id] = { id: value.id, trackId: value.trackId, seconds: Math.max(0, round(value.seconds)), titleSnapshot: clean(value.titleSnapshot, 160), note: clean(value.note, NOTE_MAX), createdAt: typeof value.createdAt === 'string' ? value.createdAt : '', updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '' };
  }
  return out;
}
