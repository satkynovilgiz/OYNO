/**
 * Achievement Showcase - up to 3 of the person's EARNED achievements,
 * pinned in their order. Stores only ids (title, artwork and details stay
 * in the one achievement catalog). Private/local: no public profile, no
 * ranking, no rarity.
 */
export const MAX_PINS = 3;

/** Pin an earned, not-yet-pinned achievement while a slot is free. */
export function pin(pins: readonly string[], id: string, earnedIds: readonly string[]): string[] {
  if (!earnedIds.includes(id) || pins.includes(id) || pins.length >= MAX_PINS) return [...pins];
  return [...pins, id];
}

export function unpin(pins: readonly string[], id: string): string[] {
  return pins.filter((value) => value !== id);
}

/** Reorder: move one pin left (-1) or right (+1). */
export function movePin(pins: readonly string[], id: string, delta: -1 | 1): string[] {
  const list = [...pins];
  const index = list.indexOf(id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= list.length) return list;
  [list[index], list[target]] = [list[target], list[index]];
  return list;
}

/** What may show: pins that still exist in the catalog AND are still earned (no broken cards). */
export function visiblePins(pins: readonly string[], earnedIds: readonly string[], catalogIds: readonly string[]): string[] {
  return [...new Set(pins)].filter((id) => catalogIds.includes(id) && earnedIds.includes(id)).slice(0, MAX_PINS);
}

/** Guest -> account: account pins first, then guest pins, de-duplicated, max 3 (validated on display). */
export function mergePins(into: readonly string[], from: readonly string[]): string[] {
  return [...new Set([...into, ...from])].slice(0, MAX_PINS);
}

export function sanitizePins(raw: unknown): string[] {
  return Array.isArray(raw) ? [...new Set(raw.filter((value): value is string => typeof value === 'string' && value.length <= 80))].slice(0, MAX_PINS) : [];
}
