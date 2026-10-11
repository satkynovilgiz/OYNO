import type { SupportedLanguage } from '@/i18n';

import { ACTIVITY_CATALOG, type Activity } from '@/features/home/chooser/activityChooser';

/**
 * Festival Mode - a curated session launcher for groups (a classroom, a
 * family table, a cultural event) over EXISTING OYNO activities. No
 * account, no score, nothing stored: the session lives in memory and is
 * cleared when it ends. Minutes are the activity chooser's own ESTIMATES -
 * never deadlines.
 *
 * Only activities that work as a guest and keep nothing private on screen
 * are used (no Daily progress, no lessons that record learning, no
 * journals or saved creations).
 */
export type SessionLength = 5 | 10 | 15;
export const LENGTHS: SessionLength[] = [5, 10, 15];

/** Guest-friendly activities (ids from ACTIVITY_CATALOG). */
export const GUEST_ACTIVITIES = ['detective', 'mapChallenge', 'jaaAtuu', 'kyzKuumai', 'kokBoru', 'duel', 'restore', 'bozUy', 'shyrdak', 'komuzListen', 'repeatRhythm'] as const;
export type FestivalSet = { id: string; length: SessionLength; activityIds: string[] };

/** Curated sets: 2-3 activities whose estimates add up to about the chosen length. */
export const FESTIVAL_SETS: FestivalSet[] = [
  { id: 'quick-play', length: 5, activityIds: ['jaaAtuu', 'kyzKuumai'] },
  { id: 'quick-discover', length: 5, activityIds: ['detective', 'restore'] },
  { id: 'together-10', length: 10, activityIds: ['duel', 'detective', 'jaaAtuu'] },
  { id: 'make-and-listen', length: 10, activityIds: ['bozUy', 'repeatRhythm'] },
  { id: 'festival-15', length: 15, activityIds: ['duel', 'bozUy', 'repeatRhythm'] },
  { id: 'crafts-15', length: 15, activityIds: ['shyrdak', 'restore', 'komuzListen'] },
];

export const activityById = (id: string): Activity | null => ACTIVITY_CATALOG.find((activity) => activity.id === id) ?? null;
export const setsFor = (length: SessionLength) => FESTIVAL_SETS.filter((set) => set.length === length);
export const estimate = (set: FestivalSet) => set.activityIds.reduce((sum, id) => sum + (activityById(id)?.minutes ?? 0), 0);

/**
 * An activity that can't open now (e.g. offline without its data) is
 * replaced by the first other guest activity of the same interest that can,
 * not already in the set - or kept, marked unavailable, when none can.
 */
export function planSet(set: FestivalSet, canOpen: (route: string) => boolean): { id: string; replaces: string | null; available: boolean }[] {
  const used = new Set(set.activityIds);
  return set.activityIds.map((id) => {
    const activity = activityById(id);
    if (activity && canOpen(activity.route)) return { id, replaces: null, available: true };
    const alternative = GUEST_ACTIVITIES.map(activityById).find((candidate) => candidate && candidate.interest === activity?.interest && !used.has(candidate.id) && canOpen(candidate.route));
    if (alternative) {
      used.add(alternative.id);
      return { id: alternative.id, replaces: id, available: true };
    }
    return { id, replaces: null, available: false };
  });
}

export type ItemStatus = 'waiting' | 'started' | 'explored' | 'skipped';
export type Session = {
  setId: string;
  length: SessionLength;
  /** Chosen explicitly for this session; the app's own language is restored at the end. */
  language: SupportedLanguage;
  previousLanguage: SupportedLanguage;
  items: { id: string; status: ItemStatus; replaces: string | null; available: boolean }[];
  current: number;
};

export function startSession(set: FestivalSet, language: SupportedLanguage, previousLanguage: SupportedLanguage, canOpen: (route: string) => boolean): Session {
  return { setId: set.id, length: set.length, language, previousLanguage, items: planSet(set, canOpen).map((entry) => ({ ...entry, status: 'waiting' })), current: 0 };
}

export type SessionAction = { type: 'open'; index: number } | { type: 'next' } | { type: 'skip' };

/** Explicit moves only: opening marks "started"; "Next activity" marks the current one explored. */
export function sessionReducer(session: Session, action: SessionAction): Session {
  const items = [...session.items];
  switch (action.type) {
    case 'open': {
      const item = items[action.index];
      if (!item || !item.available) return session;
      items[action.index] = { ...item, status: item.status === 'explored' ? 'explored' : 'started' };
      return { ...session, items, current: action.index };
    }
    case 'next':
    case 'skip': {
      const item = items[session.current];
      if (!item) return session;
      items[session.current] = { ...item, status: action.type === 'next' && item.status !== 'waiting' ? 'explored' : item.status === 'explored' ? 'explored' : 'skipped' };
      const next = items.findIndex((entry, index) => index > session.current && entry.status === 'waiting' && entry.available);
      return { ...session, items, current: next >= 0 ? next : items.length };
    }
  }
}

export const isComplete = (session: Session) => session.current >= session.items.length;
/** A shared-device activity is in progress: ending needs a confirmation. */
export const needsConfirmToEnd = (session: Session) => session.items.some((item) => item.status === 'started' && activityById(item.id)?.together);
/** The group summary: activity names only - never private notes, records or creations. */
export const summary = (session: Session) => session.items.filter((item) => item.status === 'explored').map((item) => item.id);

/* ---------- the session in memory (ephemeral; cleared at the end) ---------- */

let active: Session | null = null;
export const keepSession = (session: Session | null) => {
  active = session;
};
export const currentSession = () => active;
