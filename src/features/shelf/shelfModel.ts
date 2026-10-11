import type { Capsule } from '@/features/capsules/capsuleModel';
import type { Board } from '@/features/culture/board/boardModel';
import type { Exhibition } from '@/features/myCollections/museum/museumModel';
import type { CollectionsData } from '@/features/myCollections/myCollectionsModel';
import type { OymoCreationRow } from '@/services/content/oymoCreationsService';

/**
 * My OYNO Shelf - ONE view over existing creations. Nothing is copied or
 * stored here: small adapters read each existing record type and say how
 * to open it in its own screen. Only the current owner's records are ever
 * passed in.
 *
 * Sealed capsules: only allowed metadata (title, sealed state, opening
 * date) - never the message, articles or design. Search looks at titles only.
 */
export type ShelfType = 'design' | 'exhibition' | 'board' | 'capsule';
export const SHELF_TYPES: ShelfType[] = ['design', 'exhibition', 'board', 'capsule'];
/** Where the record actually lives (from the implementation): designs are saved to the account; the rest stay on this device. */
export type Storage = 'cloud' | 'device';
export const STORAGE: Record<ShelfType, Storage> = { design: 'cloud', exhibition: 'device', board: 'device', capsule: 'device' };

export type ShelfItem = {
  key: string;
  type: ShelfType;
  id: string;
  /** null = the record has no title (shown as "Untitled …"). */
  title: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  route: string;
  storage: Storage;
  /** Extra, allowed metadata (i18n key + params). */
  detail: { key: string; params?: Record<string, string | number> } | null;
};

const iso = (value: unknown): string | null => (typeof value === 'string' && !Number.isNaN(Date.parse(value)) && Date.parse(value) > 0 ? value : null);
const titleOf = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

export function designItems(rows: readonly OymoCreationRow[]): ShelfItem[] {
  return rows.map((row) => ({ key: `design:${row.id}`, type: 'design', id: row.id, title: titleOf(row.name), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), route: `/culture/oymo/create?creation=${encodeURIComponent(row.id)}`, storage: 'cloud', detail: { key: 'shelf.detail.layers', params: { count: Array.isArray(row.layers) ? row.layers.length : 0 } } }));
}

/** Exhibitions exist per collection; a collection without a saved exhibition isn't an exhibition yet. */
export function exhibitionItems(museums: Record<string, Exhibition> | undefined, collections: CollectionsData): ShelfItem[] {
  return Object.entries(museums ?? {}).flatMap(([collectionId, exhibition]) => {
    const collection = collections.collections.find((entry) => entry.id === collectionId);
    if (!collection || !exhibition) return [];
    return [{ key: `exhibition:${collectionId}`, type: 'exhibition' as const, id: collectionId, title: titleOf(exhibition.title) ?? titleOf(collection.name), createdAt: iso(collection.createdAt), updatedAt: iso(exhibition.updatedAt) ?? iso(collection.updatedAt), route: `/profile/my-collections/museum?collection=${encodeURIComponent(collectionId)}`, storage: 'device' as const, detail: { key: 'shelf.detail.exhibits', params: { count: Array.isArray(exhibition.exhibits) ? exhibition.exhibits.length : 0 } } }];
  });
}

export function boardItems(boards: readonly Board[]): ShelfItem[] {
  return boards.map((board) => ({ key: `board:${board.id}`, type: 'board', id: board.id, title: titleOf(board.title), createdAt: iso(board.createdAt), updatedAt: iso(board.updatedAt), route: `/culture/board/${encodeURIComponent(board.id)}`, storage: 'device', detail: { key: 'shelf.detail.cards', params: { count: board.cards.length } } }));
}

/** Only metadata: a sealed capsule never exposes its message, articles or design. */
export function capsuleItems(capsules: readonly Capsule[]): ShelfItem[] {
  return capsules.map((capsule) => ({
    key: `capsule:${capsule.id}`,
    type: 'capsule',
    id: capsule.id,
    title: titleOf(capsule.title),
    createdAt: iso(capsule.createdAt),
    updatedAt: iso(capsule.reflectedAt) ?? iso(capsule.openedAt) ?? iso(capsule.sealedAt) ?? iso(capsule.createdAt),
    route: `/profile/capsules/${encodeURIComponent(capsule.id)}`,
    storage: 'device',
    detail: capsule.status === 'sealed' ? { key: 'shelf.detail.sealedUntil', params: { date: capsule.openOn ?? '' } } : { key: `shelf.detail.capsule.${capsule.status}` },
  }));
}

export type SortKey = 'updated' | 'created' | 'title';
export const SORTS: SortKey[] = ['updated', 'created', 'title'];

/**
 * Filter by type, search TITLES (case/diacritics-insensitive; an untitled
 * record matches only the empty query), then sort. Missing dates always go
 * last; ties fall back to title, then the stable key - so the order never
 * jumps between renders.
 */
export function shelfView(items: readonly ShelfItem[], options: { type: ShelfType | 'all'; query: string; sort: SortKey }): ShelfItem[] {
  const fold = (value: string) => value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase();
  const query = fold(options.query.trim());
  const byTitle = (a: ShelfItem, b: ShelfItem) => {
    if (a.title === null || b.title === null) return a.title === b.title ? 0 : a.title === null ? 1 : -1;
    return a.title.localeCompare(b.title);
  };
  const byDate = (field: 'createdAt' | 'updatedAt') => (a: ShelfItem, b: ShelfItem) => {
    const x = a[field];
    const y = b[field];
    if (x === y) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return y.localeCompare(x); // newest first
  };
  const primary = options.sort === 'title' ? byTitle : byDate(options.sort === 'created' ? 'createdAt' : 'updatedAt');
  return items
    .filter((item) => options.type === 'all' || item.type === options.type)
    .filter((item) => !query || (item.title !== null && fold(item.title).includes(query)))
    .sort((a, b) => primary(a, b) || byTitle(a, b) || a.key.localeCompare(b.key));
}

/** A source's state on the shelf - an error or "not available" is never shown as an empty category. */
export type SourceState = { status: 'loading' } | { status: 'ready'; items: ShelfItem[] } | { status: 'error'; retry: () => void } | { status: 'unavailable'; reason: 'signedOut' };
