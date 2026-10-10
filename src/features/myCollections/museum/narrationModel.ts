/**
 * Mini Museum - the curator's own narration for an exhibit: an optional
 * short recording made on this device and/or written words. The written
 * words are typed by the curator (as a transcript of the recording, or as
 * the narration itself when there is no recording) - nothing is
 * transcribed automatically.
 *
 * The exhibition stores only a reference (`audioId`) and the text; the
 * audio lives in owner-bound device storage (services/museum/narrationAudio).
 */
export const MAX_NARRATION_MS = 60_000;
export const NARRATION_TEXT_MAX = 600;

export type Narration = { audioId: string | null; durationMs: number; text: string };
type Keyed = Record<string, Narration>;

const AUDIO_ID = /^[A-Za-z0-9-]{8,64}$/;
const cleanText = (value: string) => value.replace(/[<>{}]/g, '').slice(0, NARRATION_TEXT_MAX);

/** Narrations only for shown exhibits; ids and lengths checked; empty entries dropped. */
export function normalizeNarrations(raw: unknown, exhibits: readonly string[]): Keyed {
  const out: Keyed = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const key of exhibits) {
    const entry = (raw as Record<string, Partial<Narration> | undefined>)[key];
    if (!entry || typeof entry !== 'object') continue;
    const audioId = typeof entry.audioId === 'string' && AUDIO_ID.test(entry.audioId) ? entry.audioId : null;
    const text = typeof entry.text === 'string' ? cleanText(entry.text) : '';
    const durationMs = audioId && typeof entry.durationMs === 'number' && Number.isFinite(entry.durationMs) ? Math.max(0, Math.min(MAX_NARRATION_MS, Math.round(entry.durationMs))) : 0;
    if (audioId || text.trim()) out[key] = { audioId, durationMs, text };
  }
  return out;
}

const put = (narrations: Keyed | undefined, key: string, next: Narration): Keyed => {
  const copy = { ...(narrations ?? {}) };
  if (next.audioId || next.text.trim()) copy[key] = next;
  else delete copy[key];
  return copy;
};
const current = (narrations: Keyed | undefined, key: string): Narration => narrations?.[key] ?? { audioId: null, durationMs: 0, text: '' };

export function setNarrationText(narrations: Keyed | undefined, key: string, text: string): Keyed {
  return put(narrations, key, { ...current(narrations, key), text: cleanText(text) });
}
/** A confirmed, SAVED recording replaces the previous one. Returns the audio id that is no longer referenced (delete it). */
export function attachRecording(narrations: Keyed | undefined, key: string, audioId: string, durationMs: number): { narrations: Keyed; released: string | null } {
  const before = current(narrations, key);
  return { narrations: put(narrations, key, { ...before, audioId, durationMs: Math.min(MAX_NARRATION_MS, Math.max(0, Math.round(durationMs))) }), released: before.audioId && before.audioId !== audioId ? before.audioId : null };
}
/** Deletes the recording; the written words stay. */
export function detachRecording(narrations: Keyed | undefined, key: string): { narrations: Keyed; released: string | null } {
  const before = current(narrations, key);
  return { narrations: put(narrations, key, { ...before, audioId: null, durationMs: 0 }), released: before.audioId };
}

/** Every audio id an owner's stored exhibitions still reference (raw, before normalising). */
export function referencedAudio(exhibitions: Record<string, { narrations?: unknown } | undefined> | undefined): Set<string> {
  const ids = new Set<string>();
  for (const exhibition of Object.values(exhibitions ?? {})) {
    const narrations = exhibition?.narrations;
    if (!narrations || typeof narrations !== 'object') continue;
    for (const entry of Object.values(narrations as Record<string, Partial<Narration>>)) if (typeof entry?.audioId === 'string') ids.add(entry.audioId);
  }
  return ids;
}

/** The audio ids referenced by `before` that `after` no longer references. */
export function releasedAudio(before: { narrations?: unknown } | null | undefined, after: { narrations?: unknown } | null | undefined): string[] {
  const kept = referencedAudio({ after: after ?? undefined });
  return [...referencedAudio({ before: before ?? undefined })].filter((id) => !kept.has(id));
}

/* ---------- the recording lifecycle (pure) ---------- */

export type RecorderPhase =
  /** Nothing in progress. `explain` = the microphone explanation is showing (before the OS prompt). */
  | { kind: 'idle'; explain: boolean }
  | { kind: 'denied' }
  | { kind: 'recording'; startedAt: number }
  /** A TEMPORARY recording waiting for the curator: preview, save or discard. Not saved yet. */
  | { kind: 'review'; tempUri: string; durationMs: number; limitReached: boolean }
  | { kind: 'saving'; tempUri: string; durationMs: number }
  | { kind: 'failed'; reason: 'start' | 'save' };

export type RecorderEvent =
  | { type: 'ask' }
  | { type: 'dismiss' }
  | { type: 'permission'; granted: boolean }
  | { type: 'started'; at: number }
  | { type: 'startFailed' }
  | { type: 'stopped'; tempUri: string | null; at: number }
  | { type: 'save' }
  | { type: 'saved' }
  | { type: 'saveFailed' }
  | { type: 'discard' };

export const RECORDER_IDLE: RecorderPhase = { kind: 'idle', explain: false };

export function recorderReducer(phase: RecorderPhase, event: RecorderEvent): RecorderPhase {
  switch (event.type) {
    case 'ask':
      return phase.kind === 'idle' || phase.kind === 'denied' || phase.kind === 'failed' ? { kind: 'idle', explain: true } : phase;
    case 'dismiss':
      return phase.kind === 'idle' ? RECORDER_IDLE : phase;
    case 'permission':
      if (phase.kind !== 'idle') return phase;
      return event.granted ? phase : { kind: 'denied' };
    case 'started':
      return phase.kind === 'idle' ? { kind: 'recording', startedAt: event.at } : phase;
    case 'startFailed':
      return phase.kind === 'idle' ? { kind: 'failed', reason: 'start' } : phase;
    case 'stopped': {
      if (phase.kind !== 'recording') return phase;
      if (!event.tempUri) return RECORDER_IDLE;
      const durationMs = Math.min(MAX_NARRATION_MS, Math.max(0, event.at - phase.startedAt));
      return { kind: 'review', tempUri: event.tempUri, durationMs, limitReached: event.at - phase.startedAt >= MAX_NARRATION_MS };
    }
    case 'save':
      return phase.kind === 'review' ? { kind: 'saving', tempUri: phase.tempUri, durationMs: phase.durationMs } : phase;
    case 'saved':
      return phase.kind === 'saving' ? RECORDER_IDLE : phase;
    case 'saveFailed':
      return phase.kind === 'saving' ? { kind: 'failed', reason: 'save' } : phase;
    case 'discard':
      return phase.kind === 'review' || phase.kind === 'failed' || phase.kind === 'denied' ? RECORDER_IDLE : phase;
  }
}

/** The temporary file a phase holds (to delete on discard / leave / failure). */
export const tempOf = (phase: RecorderPhase): string | null => (phase.kind === 'review' || phase.kind === 'saving' ? phase.tempUri : null);

/** "0:42" */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
