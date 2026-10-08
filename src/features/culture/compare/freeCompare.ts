import type { CultureItemRow } from '@/services/content/types';

import { CULTURE_CONNECTIONS, REVERSE_LABEL, type CultureConnection } from '../connections/connectionsData';

/**
 * Free Compare - ANY two culture items, read side by side. Only fields that
 * exist in the content model (CultureItemRow) and only each item's own
 * authored text, unchanged. Where one side has no text for a field it says
 * "Not provided" - no difference is ever written. Connections are shown
 * only when the curated connection data explicitly links this pair.
 * The pair lives in the route (ephemeral): no store, no backend.
 */
export const FREE_FIELDS = ['origin', 'history', 'cultural_meaning', 'when_used', 'ingredients', 'traditional_method', 'who_participates', 'objects_used', 'regional_notes', 'modern_status', 'fun_facts'] as const;
export type FreeField = (typeof FREE_FIELDS)[number];

export const FREE_LABEL_KEY: Record<FreeField, string> = {
  origin: 'culture.item.originLabel',
  history: 'culture.item.historyLabel',
  cultural_meaning: 'culture.item.culturalMeaningLabel',
  when_used: 'culture.item.whenUsedLabel',
  ingredients: 'culture.item.ingredientsLabel',
  traditional_method: 'culture.item.traditionalMethodLabel',
  who_participates: 'culture.item.whoParticipatesLabel',
  objects_used: 'culture.item.objectsUsedLabel',
  regional_notes: 'culture.item.regionalNotesLabel',
  modern_status: 'culture.item.modernStatusLabel',
  fun_facts: 'culture.item.funFactsLabel',
};

const textOf = (item: CultureItemRow, field: FreeField): string | null => {
  const value = item[field];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

/** null = "Not provided" for that side. */
export type FreeRow = { field: FreeField; left: string | null; right: string | null };

/**
 * One row per field that AT LEAST ONE side authored, in the article's own
 * order. Fields neither item has are left out (and counted) - nothing to
 * compare there.
 */
export function freeCompareRows(left: CultureItemRow, right: CultureItemRow): { rows: FreeRow[]; neither: FreeField[] } {
  const rows: FreeRow[] = [];
  const neither: FreeField[] = [];
  for (const field of FREE_FIELDS) {
    const a = textOf(left, field);
    const b = textOf(right, field);
    if (a || b) rows.push({ field, left: a, right: b });
    else neither.push(field);
  }
  return { rows, neither };
}

/** Curated connections that link EXACTLY this pair (either way), read from the left item. */
export function pairConnections(leftId: string, rightId: string, connections: readonly CultureConnection[] = CULTURE_CONNECTIONS): { connection: CultureConnection; labelKey: string }[] {
  return connections.flatMap((connection) => {
    if (connection.fromType !== 'culture_item' || connection.toType !== 'culture_item') return [];
    if (connection.fromId === leftId && connection.toId === rightId) return [{ connection, labelKey: connection.relationKey as string }];
    if (connection.fromId === rightId && connection.toId === leftId) {
      // Seen from the left item, the relation reads in reverse - only when the data allows it.
      const reverse = connection.reverse ? REVERSE_LABEL[connection.relationKey] : null;
      return [{ connection, labelKey: reverse ?? connection.relationKey }];
    }
    return [];
  });
}

export type Pair = { left: string | null; right: string | null };
export type Side = 'left' | 'right';

/** Choose (or replace) one side. Picking the item already on the other side swaps them. */
export function choose(pair: Pair, side: Side, id: string): Pair {
  const other: Side = side === 'left' ? 'right' : 'left';
  if (pair[other] === id) return { [side]: id, [other]: pair[side] } as Pair;
  return { ...pair, [side]: id };
}
export const swap = (pair: Pair): Pair => ({ left: pair.right, right: pair.left });

export function freeCompareRoute(pair: Pair): string {
  const params = [pair.left ? `left=${encodeURIComponent(pair.left)}` : null, pair.right ? `right=${encodeURIComponent(pair.right)}` : null].filter(Boolean).join('&');
  return `/culture/compare/pick${params ? `?${params}` : ''}`;
}

/** Items that can be chosen: the loaded catalogue, minus the item on the other side, filtered by title. */
export function choices(items: readonly CultureItemRow[], query: string, exclude: string | null): CultureItemRow[] {
  const needle = query.trim().toLocaleLowerCase();
  return items.filter((item) => item.id !== exclude && (!needle || item.title.toLocaleLowerCase().includes(needle) || (item.alt_names ?? '').toLocaleLowerCase().includes(needle)));
}
