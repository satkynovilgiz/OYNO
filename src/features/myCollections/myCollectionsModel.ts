/**
 * My Collections - the user's own PRIVATE groupings of existing OYNO
 * content (separate from OYNO's editorial Collections, which stay as they
 * are). Pure rules, no storage, no UI.
 *
 * Only references are stored - { contentType, contentId } - never a copy
 * of a title, body or image: everything shown is resolved from the live
 * content catalog, so a renamed item shows its new name and a removed one
 * shows "Content unavailable".
 */

export const COLLECTION_CONTENT_TYPES = ['culture_item', 'culture_material', 'game', 'region', 'nature', 'trail', 'collection', 'interactive_experience'] as const;
export type CollectionContentType = (typeof COLLECTION_CONTENT_TYPES)[number];

export type UserCollection = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserCollectionItem = {
  collectionId: string;
  contentType: CollectionContentType;
  contentId: string;
  sortOrder: number;
  addedAt: string;
};

export type CollectionsData = { collections: UserCollection[]; items: UserCollectionItem[] };

export const EMPTY_COLLECTIONS: CollectionsData = { collections: [], items: [] };

export const NAME_MAX = 60;
export const DESCRIPTION_MAX = 240;

export type FieldProblem = 'empty' | 'tooLong' | 'markup';

/** User text stays exactly as typed (never translated, never generated);
 * only trimmed and checked. */
export function validateName(name: string): FieldProblem | null {
  const trimmed = name.trim();
  if (!trimmed) return 'empty';
  if (trimmed.length > NAME_MAX) return 'tooLong';
  if (/[<>{}]/.test(trimmed)) return 'markup';
  return null;
}

export function validateDescription(description: string): FieldProblem | null {
  const trimmed = description.trim();
  if (trimmed.length > DESCRIPTION_MAX) return 'tooLong';
  if (/[<>{}]/.test(trimmed)) return 'markup';
  return null;
}

export function isSupportedType(type: string): type is CollectionContentType {
  return (COLLECTION_CONTENT_TYPES as readonly string[]).includes(type);
}

let counter = 0;
export function newCollectionId(now: Date): string {
  counter = (counter + 1) % 1e6;
  return `uc_${now.getTime().toString(36)}_${counter.toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function createCollection(data: CollectionsData, input: { name: string; description?: string | null }, now = new Date()): { data: CollectionsData; collection: UserCollection } {
  if (validateName(input.name) || validateDescription(input.description ?? '')) throw new Error('INVALID_COLLECTION');
  const at = now.toISOString();
  const collection: UserCollection = { id: newCollectionId(now), name: input.name.trim(), description: input.description?.trim() || null, createdAt: at, updatedAt: at };
  return { data: { ...data, collections: [...data.collections, collection] }, collection };
}

export function editCollection(data: CollectionsData, id: string, input: { name: string; description: string | null }, now = new Date()): CollectionsData {
  if (validateName(input.name) || validateDescription(input.description ?? '')) throw new Error('INVALID_COLLECTION');
  return {
    ...data,
    collections: data.collections.map((collection) =>
      collection.id === id ? { ...collection, name: input.name.trim(), description: input.description?.trim() || null, updatedAt: now.toISOString() } : collection,
    ),
  };
}

/** Removes the collection and ITS memberships - nothing else (favorites,
 * content, progress and Journal entries are separate state). */
export function deleteCollection(data: CollectionsData, id: string): CollectionsData {
  return { collections: data.collections.filter((collection) => collection.id !== id), items: data.items.filter((item) => item.collectionId !== id) };
}

export function itemsOf(data: CollectionsData, collectionId: string): UserCollectionItem[] {
  return data.items.filter((item) => item.collectionId === collectionId).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function contains(data: CollectionsData, collectionId: string, contentType: string, contentId: string): boolean {
  return data.items.some((item) => item.collectionId === collectionId && item.contentType === contentType && item.contentId === contentId);
}

/** Adds at the end; the same item twice in ONE collection is ignored (it
 * may be in any number of different collections). */
export function addItem(data: CollectionsData, collectionId: string, contentType: CollectionContentType, contentId: string, now = new Date()): CollectionsData {
  if (!data.collections.some((collection) => collection.id === collectionId)) return data;
  if (contains(data, collectionId, contentType, contentId)) return data;
  const last = itemsOf(data, collectionId).at(-1);
  const item: UserCollectionItem = { collectionId, contentType, contentId, sortOrder: (last?.sortOrder ?? -1) + 1, addedAt: now.toISOString() };
  return { collections: touch(data.collections, collectionId, now), items: [...data.items, item] };
}

/** Removes ONE membership - the content, Saved and progress are untouched. */
export function removeItem(data: CollectionsData, collectionId: string, contentType: string, contentId: string, now = new Date()): CollectionsData {
  if (!contains(data, collectionId, contentType, contentId)) return data;
  return {
    collections: touch(data.collections, collectionId, now),
    items: data.items.filter((item) => !(item.collectionId === collectionId && item.contentType === contentType && item.contentId === contentId)),
  };
}

export function moveItem(data: CollectionsData, collectionId: string, index: number, delta: -1 | 1, now = new Date()): CollectionsData {
  const ordered = itemsOf(data, collectionId);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= ordered.length) return data;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  const renumbered = ordered.map((item, position) => ({ ...item, sortOrder: position }));
  return { collections: touch(data.collections, collectionId, now), items: [...data.items.filter((item) => item.collectionId !== collectionId), ...renumbered] };
}

function touch(collections: UserCollection[], id: string, now: Date): UserCollection[] {
  return collections.map((collection) => (collection.id === id ? { ...collection, updatedAt: now.toISOString() } : collection));
}

/**
 * A guest's collections joining an account (sign-in never loses them, and
 * never overwrites the account's own): collections are unioned by id; for
 * the same id the newer updatedAt keeps its name/description; memberships
 * are unioned with no duplicates, and the account's order goes first.
 */
export function mergeCollections(into: CollectionsData, from: CollectionsData): CollectionsData {
  const byId = new Map(into.collections.map((collection) => [collection.id, collection]));
  for (const collection of from.collections) {
    const existing = byId.get(collection.id);
    if (!existing || collection.updatedAt > existing.updatedAt) byId.set(collection.id, collection);
  }
  const items = [...into.items];
  for (const item of from.items) {
    if (!byId.has(item.collectionId)) continue;
    if (items.some((other) => other.collectionId === item.collectionId && other.contentType === item.contentType && other.contentId === item.contentId)) continue;
    const last = items.filter((other) => other.collectionId === item.collectionId).reduce((max, other) => Math.max(max, other.sortOrder), -1);
    items.push({ ...item, sortOrder: last + 1 });
  }
  return { collections: [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), items };
}

/** What the screens need to draw one reference (resolved from the
 * catalog, never stored). */
export type ResolvedContent = { title: string; route: string | null; thumbnail: unknown | null };

export type CollectionEntry = { item: UserCollectionItem; content: ResolvedContent | null };

/** Every membership, in order; a reference whose content no longer exists
 * resolves to null ("Content unavailable", removable) - never a crash. */
export function resolveEntries(data: CollectionsData, collectionId: string, resolve: (contentType: string, contentId: string) => ResolvedContent | null): CollectionEntry[] {
  return itemsOf(data, collectionId).map((item) => ({ item, content: resolve(item.contentType, item.contentId) }));
}

/** Cover: the first item that has its own image; else null (the UI then
 * draws the OYNO tone + ornament - never a broken image). */
export function coverFor(entries: CollectionEntry[]): unknown | null {
  return entries.find((entry) => entry.content?.thumbnail)?.content?.thumbnail ?? null;
}

/** Local title search - only offered once a collection is long enough. */
export const SEARCH_MIN_ITEMS = 8;

export function filterEntries(entries: CollectionEntry[], query: string): CollectionEntry[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return entries;
  return entries.filter((entry) => entry.content?.title.toLocaleLowerCase().includes(needle));
}

/** Analytics carry structure only - never the user's names/descriptions. */
export function collectionEventProps(contentType?: CollectionContentType): Record<string, string> {
  return contentType ? { content_type: contentType } : {};
}
