import type { Exhibition, ExhibitKey, ExhibitSlide } from './museumModel';

/**
 * "Look Closely" - an optional observation challenge a curator builds from
 * their OWN exhibition (no other collection): up to three exhibits form the
 * answer gallery, and up to three short clues each point at one of them.
 *
 * Clues are the curator's words - shown as such, never as verified OYNO
 * facts. Visitors' answers live only in the session (never stored, never
 * learning progress, no quiz statistics).
 */
export const LOOK_MAX_EXHIBITS = 3;
export const LOOK_MAX_CLUES = 3;
export const CLUE_MAX = 120;

export type LookClue = { id: string; target: ExhibitKey; text: string };
export type LookClosely = { exhibits: ExhibitKey[]; clues: LookClue[] };
export const EMPTY_LOOK: LookClosely = { exhibits: [], clues: [] };

const clean = (value: string) => value.replace(/[<>{}]/g, '').replace(/\s+/g, ' ').slice(0, CLUE_MAX);

/**
 * Re-checked on every read against the exhibition NOW: exhibits must still
 * be in it (at most three, no duplicates); a clue needs a target among
 * those exhibits. Anything else is dropped.
 */
export function normalizeLook(raw: unknown, exhibition: Pick<Exhibition, 'exhibits'>): LookClosely {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return EMPTY_LOOK;
  const value = raw as Partial<LookClosely>;
  const allowed = new Set(exhibition.exhibits);
  const exhibits = Array.isArray(value.exhibits) ? [...new Set(value.exhibits.filter((key): key is string => typeof key === 'string' && allowed.has(key)))].slice(0, LOOK_MAX_EXHIBITS) : [];
  const inGallery = new Set(exhibits);
  const ids = new Set<string>();
  const clues = (Array.isArray(value.clues) ? value.clues : [])
    .flatMap((clue) => {
      if (!clue || typeof clue !== 'object') return [];
      const { id, target, text } = clue as Partial<LookClue>;
      // An empty clue is kept while the curator is writing it; play skips it.
      if (typeof id !== 'string' || !/^[a-z0-9-]{1,20}$/.test(id) || ids.has(id) || typeof target !== 'string' || !inGallery.has(target) || typeof text !== 'string') return [];
      ids.add(id);
      return [{ id, target, text: clean(text) }];
    })
    .slice(0, LOOK_MAX_CLUES);
  return { exhibits, clues };
}

/** Curator: add (if there is room and it can be shown) or remove an exhibit; removing it drops its clues. */
export function toggleLookExhibit(look: LookClosely, key: ExhibitKey, available: boolean): LookClosely {
  if (look.exhibits.includes(key)) return { exhibits: look.exhibits.filter((entry) => entry !== key), clues: look.clues.filter((clue) => clue.target !== key) };
  if (!available || look.exhibits.length >= LOOK_MAX_EXHIBITS) return look;
  return { ...look, exhibits: [...look.exhibits, key] };
}

/** Curator: add or update a clue. The target must be one of the chosen exhibits. */
export function setClue(look: LookClosely, clue: LookClue): LookClosely {
  if (!look.exhibits.includes(clue.target)) return look;
  const text = clean(clue.text);
  const exists = look.clues.some((entry) => entry.id === clue.id);
  if (!exists && look.clues.length >= LOOK_MAX_CLUES) return look;
  const next = { ...clue, text };
  return { ...look, clues: exists ? look.clues.map((entry) => (entry.id === clue.id ? next : entry)) : [...look.clues, next] };
}

export function removeClue(look: LookClosely, id: string): LookClosely {
  return { ...look, clues: look.clues.filter((clue) => clue.id !== id) };
}

export const canPlay = (look: LookClosely) => look.clues.some((clue) => clue.text.trim()) && look.exhibits.length >= 2;

/** Visitor view: the answer gallery is the chosen exhibits that can be shown now; clues for missing targets are listed as unavailable, never blocking. */
export type PlayableClue = LookClue & { available: boolean };
export function playableLook(look: LookClosely, slides: readonly ExhibitSlide[]): { gallery: Extract<ExhibitSlide, { kind: 'exhibit' }>[]; clues: PlayableClue[] } {
  const shown = new Map(slides.filter((slide): slide is Extract<ExhibitSlide, { kind: 'exhibit' }> => slide.kind === 'exhibit').map((slide) => [slide.key, slide]));
  const gallery = look.exhibits.flatMap((key) => (shown.has(key) ? [shown.get(key)!] : []));
  return { gallery, clues: look.clues.filter((clue) => clue.text.trim()).map((clue) => ({ ...clue, available: shown.has(clue.target) })) };
}

/** One visitor session: per clue, the wrong guesses so far and whether it was found. No score, no penalty. */
export type LookSession = { index: number; tried: Record<string, ExhibitKey[]>; found: string[] };
export const START_LOOK: LookSession = { index: 0, tried: {}, found: [] };

export type LookAction = { type: 'answer'; clueId: string; key: ExhibitKey } | { type: 'next' } | { type: 'previous' } | { type: 'restart' };

export function lookReducer(clues: readonly PlayableClue[], session: LookSession, action: LookAction): LookSession {
  switch (action.type) {
    case 'answer': {
      const clue = clues[session.index];
      if (!clue || clue.id !== action.clueId || !clue.available || session.found.includes(clue.id)) return session;
      if (action.key === clue.target) return { ...session, found: [...session.found, clue.id] };
      const tried = session.tried[clue.id] ?? [];
      return tried.includes(action.key) ? session : { ...session, tried: { ...session.tried, [clue.id]: [...tried, action.key] } };
    }
    case 'next':
      return session.index + 1 <= clues.length ? { ...session, index: session.index + 1 } : session;
    case 'previous':
      return session.index > 0 ? { ...session, index: session.index - 1 } : session;
    case 'restart':
      return START_LOOK;
  }
}

/**
 * The game in progress, in MEMORY only (never stored): opening a source
 * article may re-create the museum screen, and the visitor should come
 * back to the clue they were on. One slot, bound to owner + collection;
 * cleared when the game ends, and ignored for anyone else.
 */
let active: { owner: string; collectionId: string; session: LookSession } | null = null;
export function keepLookSession(owner: string, collectionId: string, session: LookSession): void {
  active = { owner, collectionId, session };
}
export function resumeLookSession(owner: string, collectionId: string): LookSession | null {
  return active && active.owner === owner && active.collectionId === collectionId ? active.session : null;
}
export function endLookSession(): void {
  active = null;
}
