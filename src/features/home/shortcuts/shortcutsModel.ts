import { ACTIVITY_CATALOG, type Activity } from '../chooser/activityChooser';

/**
 * Home shortcuts - up to four pinned destinations, chosen ONLY from the
 * activity chooser's validated catalogue (every route is checked to exist
 * by tests). A display preference per owner: it never touches learning
 * progress, and labels always come from the catalogue's own titles - never
 * from a record's private contents.
 *
 * Stored per owner: { pins: string[] } (ids). No entry = the default
 * layout. Ids the app no longer has (a removed activity, a newer app's id)
 * are kept in storage untouched but not shown; the Home row and the editor
 * say how many are unavailable and let them be removed.
 */
export const MAX_PINS = 4;
/** One per interest, in the chooser's interest order. */
export const DEFAULT_PINS = ['daily', 'jaaAtuu', 'oymo', 'komuzListen'] as const;

const ID = /^[A-Za-z][A-Za-z0-9_-]{0,47}$/;
export type OwnerShortcuts = { pins: string[] } | null;

export function normalizeShortcuts(raw: unknown): OwnerShortcuts {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { pins?: unknown }).pins)) return null;
  const pins = [...new Set(((raw as { pins: unknown[] }).pins).filter((id): id is string => typeof id === 'string' && ID.test(id)))].slice(0, MAX_PINS);
  return { pins };
}

export const pinsOf = (stored: OwnerShortcuts): string[] => (stored ? stored.pins : [...DEFAULT_PINS]);
export const isDefault = (stored: OwnerShortcuts) => stored === null;

export type ResolvedPin = { activity: Activity; available: boolean };
export function resolvePins(pins: readonly string[], isAvailable: (route: string) => boolean, catalog: readonly Activity[] = ACTIVITY_CATALOG): { shown: ResolvedPin[]; unavailableIds: string[] } {
  const shown: ResolvedPin[] = [];
  const unavailableIds: string[] = [];
  for (const id of pins) {
    const activity = catalog.find((entry) => entry.id === id);
    if (!activity) unavailableIds.push(id);
    else shown.push({ activity, available: isAvailable(activity.route) });
  }
  return { shown, unavailableIds };
}

export type PinChange = { type: 'add'; id: string } | { type: 'remove'; id: string } | { type: 'move'; id: string; delta: -1 | 1 } | { type: 'removeUnavailable' } | { type: 'reset' };

/** The next stored value, or the SAME object when nothing would change (the caller then writes nothing). */
export function applyPinChange(stored: OwnerShortcuts, change: PinChange, catalog: readonly Activity[] = ACTIVITY_CATALOG): OwnerShortcuts {
  if (change.type === 'reset') return null;
  const pins = pinsOf(stored);
  const known = (id: string) => catalog.some((entry) => entry.id === id);
  let next: string[] = pins;
  if (change.type === 'add') {
    if (!known(change.id) || pins.includes(change.id) || pins.length >= MAX_PINS) return stored;
    next = [...pins, change.id];
  } else if (change.type === 'remove') {
    if (!pins.includes(change.id)) return stored;
    next = pins.filter((id) => id !== change.id);
  } else if (change.type === 'removeUnavailable') {
    next = pins.filter(known);
    if (next.length === pins.length) return stored;
  } else {
    const index = pins.indexOf(change.id);
    const target = index + change.delta;
    if (index < 0 || target < 0 || target >= pins.length) return stored;
    next = [...pins];
    [next[index], next[target]] = [next[target], next[index]];
  }
  return { pins: next };
}

/** Catalogue activities that can still be pinned (not pinned yet), in catalogue order. */
export const pinnable = (pins: readonly string[], catalog: readonly Activity[] = ACTIVITY_CATALOG) => catalog.filter((entry) => !pins.includes(entry.id));
